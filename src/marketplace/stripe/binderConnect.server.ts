import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { assertExpectedStripeAccount, getMarketplaceStripeClient } from "./stripeClient.server";
import { findWorkshopCustomerAccount } from "./workshopAccountRecovery.server";

type Supa = SupabaseClient<Database>;

export interface BinderConnectStatus {
  binderId: string;
  stripeAccountId: string | null;
  onboarded: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirements: string[];
  configurationCompatible: boolean;
}

/** Accounts v2 is authoritative; a cached flag never authorizes a charge. */
export async function readWorkshopConnectAccount(accountId: string) {
  await assertExpectedStripeAccount();
  const account = await getMarketplaceStripeClient().v2.core.accounts.retrieve(accountId, {
    include: ["configuration.merchant", "defaults", "requirements"],
  });
  const capabilities = account.configuration?.merchant?.capabilities;
  const responsibilities = account.defaults?.responsibilities;
  const chargesEnabled = capabilities?.card_payments?.status === "active";
  const payoutsEnabled = capabilities?.stripe_balance?.payouts?.status === "active";
  const configurationCompatible =
    !account.closed &&
    account.dashboard === "full" &&
    responsibilities?.fees_collector === "stripe" &&
    responsibilities?.losses_collector === "stripe" &&
    responsibilities?.requirements_collector === "stripe";
  return {
    account,
    chargesEnabled,
    payoutsEnabled,
    configurationCompatible,
    onboarded: chargesEnabled && payoutsEnabled && configurationCompatible,
    requirements: (account.requirements?.entries ?? [])
      .filter((entry) => entry.awaiting_action_from === "user")
      .map((entry) => entry.description),
  };
}

/**
 * Crée le compte Stripe de l'atelier avec Dashboard complet s'il n'en a pas
 * encore un, sinon renvoie celui qui existe déjà — idempotent par
 * construction (le champ `stripe_account_id` est la source de vérité,
 * jamais recréé une deuxième fois pour le même atelier).
 */
export async function ensureBinderStripeAccount(sb: Supa, binderId: string): Promise<string> {
  const { data: binder, error } = await sb
    .from("marketplace_binders")
    .select("id, user_id, stripe_account_id, display_name, workshop_name, country_code")
    .eq("id", binderId)
    .maybeSingle();
  if (error) throw error;
  if (!binder) throw new Error(`Atelier introuvable : ${binderId}`);
  if (binder.stripe_account_id) return binder.stripe_account_id;
  if (binder.country_code !== "FR") throw new Error("connect_country_not_open");

  // Avant tout appel Stripe réel — jamais après.
  await assertExpectedStripeAccount();

  const stripe = getMarketplaceStripeClient();
  const subscription = await sb
    .from("marketplace_binder_subscriptions")
    .select("stripe_customer_id")
    .eq("binder_id", binderId)
    .maybeSingle();
  if (subscription.error) throw subscription.error;
  const customerAccountId = subscription.data?.stripe_customer_id?.startsWith("acct_")
    ? subscription.data.stripe_customer_id
    : await findWorkshopCustomerAccount(binderId);
  const parameters = {
    // Activité C : atelier vendeur, frais Stripe atelier, Dashboard complet.
    dashboard: "full" as const,
    defaults: {
      responsibilities: { fees_collector: "stripe" as const, losses_collector: "stripe" as const },
    },
    configuration: {
      customer: {},
      merchant: { capabilities: { card_payments: { requested: true } } },
    },
    metadata: { binder_id: binderId },
  };
  const account = customerAccountId
    ? await stripe.v2.core.accounts.update(customerAccountId, parameters, {
        idempotencyKey: `binder-connect-direct-account-${binderId}`,
      })
    : await stripe.v2.core.accounts.create(
        {
          ...parameters,
          identity: { country: "FR" },
          display_name: binder.workshop_name || binder.display_name,
        },
        // Idempotent : un retry sur cet appel ne crée jamais un deuxième
        // Connected Account pour le même atelier.
        { idempotencyKey: `binder-connect-direct-account-${binderId}` },
      );

  const { error: updateError } = await sb
    .from("marketplace_binders")
    .update({ stripe_account_id: account.id })
    .eq("id", binderId)
    .is("stripe_account_id", null);
  if (updateError) throw updateError;
  // A concurrent attachment wins: return the stored account, never an orphan.
  const stored = await sb
    .from("marketplace_binders")
    .select("stripe_account_id")
    .eq("id", binderId)
    .single();
  if (stored.error) throw stored.error;
  if (!stored.data.stripe_account_id) throw new Error("connect_account_not_saved");
  return stored.data.stripe_account_id;
}

/** L'URL Stripe où l'atelier termine la configuration de son compte. */
export async function createBinderOnboardingLink(
  sb: Supa,
  binderId: string,
  input: { returnUrl: string; refreshUrl: string },
): Promise<{ url: string }> {
  const accountId = await ensureBinderStripeAccount(sb, binderId);
  // ensureBinderStripeAccount ne vérifie le compte que sur le chemin
  // "création" (§1) — un atelier déjà pourvu d'un stripe_account_id sort
  // avant ce garde ; on le repasse ici pour couvrir aussi ce cas.
  await assertExpectedStripeAccount();
  const stripe = getMarketplaceStripeClient();
  const link = await stripe.v2.core.accountLinks.create({
    account: accountId,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        return_url: input.returnUrl,
        refresh_url: input.refreshUrl,
        collection_options: { fields: "currently_due" },
      },
    },
  });
  return { url: link.url };
}

/**
 * Relit les capacités réelles auprès de Stripe et les met en cache sur
 * `marketplace_binders` — jamais l'inverse : les colonnes ne sont qu'une
 * copie de lecture, Stripe reste la source de vérité.
 */
export async function refreshBinderConnectStatus(
  sb: Supa,
  binderId: string,
): Promise<BinderConnectStatus> {
  const { data: binder, error } = await sb
    .from("marketplace_binders")
    .select("id, stripe_account_id")
    .eq("id", binderId)
    .maybeSingle();
  if (error) throw error;
  if (!binder) throw new Error(`Atelier introuvable : ${binderId}`);
  if (!binder.stripe_account_id) {
    return {
      binderId,
      stripeAccountId: null,
      onboarded: false,
      chargesEnabled: false,
      payoutsEnabled: false,
      configurationCompatible: false,
      requirements: [],
    };
  }

  const { chargesEnabled, payoutsEnabled, onboarded, requirements, configurationCompatible } =
    await readWorkshopConnectAccount(binder.stripe_account_id);

  const { error: updateError } = await sb
    .from("marketplace_binders")
    .update({
      stripe_connect_charges_enabled: chargesEnabled,
      stripe_connect_payouts_enabled: payoutsEnabled,
      stripe_connect_onboarded_at: onboarded ? new Date().toISOString() : null,
    })
    .eq("id", binderId);
  if (updateError) throw updateError;

  return {
    binderId,
    stripeAccountId: binder.stripe_account_id,
    onboarded,
    chargesEnabled,
    payoutsEnabled,
    requirements,
    configurationCompatible,
  };
}

/** Both snapshot account.updated and Accounts v2 notifications refresh this cache. */
export async function refreshWorkshopConnectAccountById(sb: Supa, accountId: string) {
  const binder = await sb
    .from("marketplace_binders")
    .select("id")
    .eq("stripe_account_id", accountId)
    .maybeSingle();
  if (binder.error) throw binder.error;
  if (binder.data) await refreshBinderConnectStatus(sb, binder.data.id);
}
