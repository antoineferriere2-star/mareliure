/**
 * Préparation Stripe Connect côté atelier (§18-19 du brief du 16 septembre
 * 2026) — code prêt, jamais appelé par ce chantier : « le premier Connected
 * Account créé devra correspondre à un vrai atelier partenaire ». Rien
 * n'invoque ces fonctions depuis une route ou un bouton admin pour
 * l'instant ; les brancher est un chantier séparé, une fois un atelier réel
 * prêt à démarrer son onboarding.
 *
 * Separate Charges and Transfers (§20) : ces comptes ne reçoivent jamais de
 * `on_behalf_of` sur un paiement client — seulement des `transfers` séparés,
 * une dette B2B distincte du PaymentIntent client (voir §19 : 80 % à
 * l'acceptation, 20 % au solde, ni l'un ni l'autre construit ici).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { assertExpectedStripeAccount, getMarketplaceStripeClient } from "./stripeClient.server";

type Supa = SupabaseClient<Database>;

export interface BinderConnectStatus {
  binderId: string;
  stripeAccountId: string | null;
  onboarded: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
}

async function loadBinderEmail(sb: Supa, userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const { data } = await sb.auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}

/**
 * Crée le Connected Account Stripe Express de l'atelier s'il n'en a pas
 * encore un, sinon renvoie celui qui existe déjà — idempotent par
 * construction (le champ `stripe_account_id` est la source de vérité,
 * jamais recréé une deuxième fois pour le même atelier).
 */
export async function ensureBinderStripeAccount(sb: Supa, binderId: string): Promise<string> {
  const { data: binder, error } = await sb
    .from("marketplace_binders")
    .select("id, user_id, stripe_account_id, display_name, workshop_name")
    .eq("id", binderId)
    .maybeSingle();
  if (error) throw error;
  if (!binder) throw new Error(`Atelier introuvable : ${binderId}`);
  if (binder.stripe_account_id) return binder.stripe_account_id;

  // Avant tout appel Stripe réel — jamais après.
  await assertExpectedStripeAccount();

  const email = await loadBinderEmail(sb, binder.user_id);
  const stripe = getMarketplaceStripeClient();
  const account = await stripe.accounts.create(
    {
      // Le paramètre `type: "express"` est l'ancien raccourci — le
      // planificateur Stripe (arbre de décision Connect, 16 septembre
      // 2026) demande explicitement de ne plus l'utiliser et de déclarer
      // `controller` explicitement. Ces quatre valeurs reproduisent
      // exactement un compte Express, mais en clair : la marketplace
      // porte les frais et les pertes (jamais l'atelier), garde le
      // Dashboard Express, et Stripe collecte les informations
      // d'onboarding — cohérent avec Separate Charges and Transfers
      // (§20 du brief) où la plateforme reste responsable, jamais
      // `on_behalf_of` sur l'atelier.
      controller: {
        fees: { payer: "application" },
        losses: { payments: "application" },
        stripe_dashboard: { type: "express" },
        requirement_collection: "stripe",
      },
      country: "FR",
      email: email ?? undefined,
      business_type: "individual",
      capabilities: { transfers: { requested: true } },
      metadata: { binder_id: binderId },
    },
    // Idempotent : un retry sur cet appel ne crée jamais un deuxième
    // Connected Account pour le même atelier.
    { idempotencyKey: `binder-connect-account-${binderId}` },
  );

  const { error: updateError } = await sb
    .from("marketplace_binders")
    .update({ stripe_account_id: account.id })
    .eq("id", binderId)
    .is("stripe_account_id", null);
  if (updateError) throw updateError;

  return account.id;
}

/** L'URL Stripe où l'atelier termine son onboarding Express. */
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
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    return_url: input.returnUrl,
    refresh_url: input.refreshUrl,
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
    return { binderId, stripeAccountId: null, onboarded: false, chargesEnabled: false, payoutsEnabled: false };
  }

  await assertExpectedStripeAccount();
  const stripe = getMarketplaceStripeClient();
  const account = await stripe.accounts.retrieve(binder.stripe_account_id);
  const chargesEnabled = !!account.charges_enabled;
  const payoutsEnabled = !!account.payouts_enabled;
  const onboarded = chargesEnabled && payoutsEnabled;

  const { error: updateError } = await sb
    .from("marketplace_binders")
    .update({
      stripe_connect_charges_enabled: chargesEnabled,
      stripe_connect_payouts_enabled: payoutsEnabled,
      ...(onboarded ? { stripe_connect_onboarded_at: new Date().toISOString() } : {}),
    })
    .eq("id", binderId);
  if (updateError) throw updateError;

  return { binderId, stripeAccountId: binder.stripe_account_id, onboarded, chargesEnabled, payoutsEnabled };
}
