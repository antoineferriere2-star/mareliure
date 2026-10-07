import type Stripe from "stripe";
import type { Supa } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import { findActiveBinderMembership } from "./binderMembership.server";
import {
  assertExpectedStripeAccount,
  getMarketplaceStripeClient,
} from "@/marketplace/stripe/stripeClient.server";
import {
  WORKSHOP_PRICE_LOOKUP_KEY,
  WORKSHOP_SUBSCRIPTION_TERMS,
  workshopCanCreate,
  workshopOrigin,
} from "@/marketplace/billing/workshopSubscription";
import { recoverWorkshopCheckout } from "@/marketplace/stripe/checkoutRecovery.server";
import { notifyWorkshop } from "@/marketplace/notifications/workshopNotices.server";
import { findWorkshopCustomerAccount } from "@/marketplace/stripe/workshopAccountRecovery.server";
import { frenchWorkshopTaxEligibility, isFrenchSubscriptionTaxRate, WORKSHOP_TAX_DECISION } from "@/marketplace/billing/workshopTax";
import { MARELIURE_PUBLISHER, MARELIURE_CONTACT_EMAIL } from "@/marketplace/legal/legalEntity";

export async function workshopBillingOwner(sb: Supa, userId: string) {
  const member = await findActiveBinderMembership(sb, userId);
  if (!member || member.role !== "OWNER")
    fail(403, "Seul le propriétaire de l’atelier peut gérer l’abonnement.");
  return member!.binderId;
}

export async function loadWorkshopSubscription(sb: Supa, binderId: string) {
  const [subscription, settings] = await Promise.all([
    sb.from("marketplace_binder_subscriptions").select("*").eq("binder_id", binderId).single(),
    sb.from("marketplace_workshop_offer_settings").select("*").eq("id", true).single(),
  ]);
  if (subscription.error) throw subscription.error;
  if (settings.error) throw settings.error;
  return {
    subscription: subscription.data,
    settings: settings.data,
    canCreate: workshopCanCreate(subscription.data, settings.data.subscription_open),
  };
}

export async function createWorkshopCheckout(sb: Supa, userId: string, accepted: boolean) {
  if (!accepted) fail(400, "Votre accord explicite aux conditions de l’abonnement est requis.");
  const binderId = await workshopBillingOwner(sb, userId);
  const workshop = await sb
    .from("marketplace_binder_billing_profiles")
    .select("country,postal_code,city,address_line1,legal_name,workshop_name,vat_regime,vat_number,siren")
    .eq("binder_id", binderId)
    .maybeSingle();
  if (workshop.error) throw workshop.error;
  const eligibility = frenchWorkshopTaxEligibility(workshop.data);
  if (eligibility) fail(409, eligibility);
  if (
    process.env.WORKSHOP_SUBSCRIPTION_TAX_APPROVED !== "true" ||
    !process.env.WORKSHOP_SUBSCRIPTION_VAT_RATE_ID
  )
    fail(503, "La configuration fiscale de l’abonnement reste à valider.");
  if (process.env.WORKSHOP_SUBSCRIPTION_TERMS_READY !== WORKSHOP_SUBSCRIPTION_TERMS)
    fail(503, "Les conditions publiées de l’abonnement doivent correspondre à la version proposée.");
  await assertExpectedStripeAccount();
  const stripe = getMarketplaceStripeClient();
  const { data: prices } = await stripe.prices.list({
    lookup_keys: [WORKSHOP_PRICE_LOOKUP_KEY],
    active: true,
    limit: 2,
    expand: ["data.product"],
  });
  const price = prices[0];
  if (
    prices.length !== 1 ||
    price.currency !== "eur" ||
    price.unit_amount !== 1500 ||
    price.tax_behavior !== "exclusive" ||
    price.recurring?.interval !== "month" ||
    price.recurring.interval_count !== 1
  ) {
    fail(503, "Le prix de l’abonnement n’est pas configuré.");
  }
  const taxRate = await stripe.taxRates.retrieve(process.env.WORKSHOP_SUBSCRIPTION_VAT_RATE_ID!);
  if (!isFrenchSubscriptionTaxRate(taxRate))
    fail(503, "Le taux manuel français de TVA de l’abonnement doit être actif, à 20 %, hors taxes.");
  const current = await loadWorkshopSubscription(sb, binderId);
  if (!current.settings.subscription_open)
    fail(409, "L’abonnement payant n’est pas encore ouvert.");
  let previousSession = current.subscription.checkout_session_id;
  if (!previousSession && current.subscription.checkout_expires_at) {
    const recovered = await recoverWorkshopCheckout(
      stripe,
      current.subscription.checkout_expires_at,
      { activity: "workshop_subscription", binder_id: binderId },
    );
    if (recovered) {
      const saved = await sb
        .from("marketplace_binder_subscriptions")
        .update({ checkout_session_id: recovered.id })
        .eq("binder_id", binderId)
        .eq("checkout_expires_at", current.subscription.checkout_expires_at)
        .is("checkout_session_id", null);
      if (saved.error) throw saved.error;
      previousSession = recovered.id;
    }
  }
  if (previousSession) {
    const previous = await stripe.checkout.sessions.retrieve(previousSession);
    if (previous.status === "open" && previous.url) {
      if (currentWorkshopCheckout(previous, taxRate.id)) return { url: previous.url };
      // An older reservation must not bypass the newly accepted fiscal terms.
      await stripe.checkout.sessions.expire(previous.id);
      previous.status = "expired";
    }
    let reason: "expired" | "subscription_ended" | null =
      previous.status === "expired" ? "expired" : null;
    const subId =
      typeof previous.subscription === "string" ? previous.subscription : previous.subscription?.id;
    if (previous.status === "complete" && subId) {
      const subscription = await stripe.subscriptions.retrieve(subId);
      if (["canceled", "incomplete_expired"].includes(subscription.status))
        reason = "subscription_ended";
    }
    if (!reason)
      fail(409, "Le paiement est en cours de rapprochement. Réessayez dans quelques instants.");
    const released = await sb.rpc("marketplace_release_workshop_subscription_checkout", {
      p_binder_id: binderId,
      p_session_id: previousSession,
      p_reason: reason!,
    });
    if (released.error) throw released.error;
  }
  const { data, error } = await sb.rpc("marketplace_reserve_workshop_checkout", {
    p_binder_id: binderId,
    p_user_id: userId,
    p_terms_version: WORKSHOP_SUBSCRIPTION_TERMS,
  });
  if (error) throw error;
  const reserved = data as {
    stripe_customer_id: string | null;
    checkout_session_id: string | null;
    checkout_expires_at: string;
  };
  if (reserved.checkout_session_id) {
    const existing = await stripe.checkout.sessions.retrieve(reserved.checkout_session_id);
    if (existing.status === "open" && existing.url && currentWorkshopCheckout(existing, taxRate.id))
      return { url: existing.url };
    fail(409, "Le paiement est en cours de rapprochement. Réessayez dans quelques instants.");
  }
  let customer = reserved.stripe_customer_id;
  if (!customer) {
    const binder = await sb
      .from("marketplace_binders")
      .select("stripe_account_id")
      .eq("id", binderId)
      .single();
    if (binder.error) throw binder.error;
    const customerAccountId =
      binder.data.stripe_account_id ?? (await findWorkshopCustomerAccount(binderId));
    const created = customerAccountId
      ? await stripe.v2.core.accounts.update(customerAccountId, {
          configuration: { customer: {} },
        })
      : await stripe.v2.core.accounts.create(
          {
            configuration: { customer: {} },
            metadata: { binder_id: binderId, activity: "workshop_subscription" },
          },
          { idempotencyKey: `workshop-customer-${binderId}` },
        );
    customer = created.id;
    const saved = await sb
      .from("marketplace_binder_subscriptions")
      .update({ stripe_customer_id: customer })
      .eq("binder_id", binderId);
    if (saved.error) throw saved.error;
  }
  const metadata = {
    binder_id: binderId,
    activity: "workshop_subscription",
    terms_version: WORKSHOP_SUBSCRIPTION_TERMS,
    tax_decision: WORKSHOP_TAX_DECISION.id,
    manual_tax_rate_id: taxRate.id,
    establishment_country: workshop.data!.country!,
    establishment_postal_code: workshop.data!.postal_code!,
    professional_customer: "true",
    customer_vat_regime: workshop.data!.vat_regime!,
  };
  const invoiceSettings = {
    footer: `${MARELIURE_PUBLISHER.name} — ${MARELIURE_PUBLISHER.legalForm} — capital ${MARELIURE_PUBLISHER.capital} — ${MARELIURE_PUBLISHER.address} — ${MARELIURE_PUBLISHER.rcs} — SIRET ${MARELIURE_PUBLISHER.siret} — TVA ${MARELIURE_PUBLISHER.vat} — ${MARELIURE_CONTACT_EMAIL}`,
    ...(workshop.data!.siren ? { custom_fields: [{ name: "SIREN client", value: workshop.data!.siren }] } : {}),
  };
  if (customer.startsWith("acct_")) {
    await stripe.v2.core.accounts.update(customer, { configuration: { customer: { billing: { invoice: invoiceSettings } } } });
  } else {
    await stripe.customers.update(customer, { invoice_settings: invoiceSettings });
  }
  const origin = workshopOrigin();
  const session = await stripe.checkout.sessions.create(
    {
      ...(customer.startsWith("acct_") ? { customer_account: customer } : { customer }),
      mode: "subscription",
      integration_identifier: "oppe_workshop_subscription_cfjmkpwa",
      line_items: [{ price: price.id, quantity: 1, tax_rates: [taxRate.id] }],
      automatic_tax: { enabled: false },
      billing_address_collection: "required",
      customer_update: { address: "auto", name: "auto" },
      name_collection: { business: { enabled: true, optional: false } },
      // A professional in franchise has no VAT ID to enter. Its identity is
      // still required, and OPPE still collects the same 20 % VAT.
      tax_id_collection: { enabled: workshop.data!.vat_regime !== "FRANCHISE" },
      metadata,
      subscription_data: { metadata },
      expires_at: Math.floor(Date.parse(reserved.checkout_expires_at) / 1000),
      success_url: `${origin}/atelier/abonnement?checkout=success`,
      cancel_url: `${origin}/atelier/abonnement?checkout=cancel`,
    },
    { idempotencyKey: `workshop-checkout-${binderId}-${reserved.checkout_expires_at}` },
  );
  const saved = await sb
    .from("marketplace_binder_subscriptions")
    .update({ checkout_session_id: session.id })
    .eq("binder_id", binderId)
    .eq("checkout_expires_at", reserved.checkout_expires_at)
    .is("checkout_session_id", null);
  if (saved.error) throw saved.error;
  if (!session.url) throw new Error("checkout_url_missing");
  return { url: session.url };
}

function currentWorkshopCheckout(session: Stripe.Checkout.Session, rateId: string) {
  return session.metadata?.terms_version === WORKSHOP_SUBSCRIPTION_TERMS &&
    session.metadata?.tax_decision === WORKSHOP_TAX_DECISION.id &&
    session.metadata?.manual_tax_rate_id === rateId &&
    session.name_collection?.business?.enabled === true &&
    !session.automatic_tax?.enabled && session.amount_total === 1800 &&
    session.total_details?.amount_tax === 300;
}

export async function syncWorkshopSubscriptionEvent(
  sb: Supa,
  event: Stripe.Event,
): Promise<boolean> {
  if (event.account) return false;
  let subscriptionId: string | null = null;
  const object = event.data.object;
  if (event.type.startsWith("customer.subscription."))
    subscriptionId = (object as Stripe.Subscription).id;
  else if (event.type.startsWith("checkout.session.")) {
    const session = object as Stripe.Checkout.Session;
    if (session.metadata?.activity !== "workshop_subscription") return false;
    subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : (session.subscription?.id ?? null);
    if (!subscriptionId) return true;
  } else if (event.type.startsWith("invoice.")) {
    const invoice = object as Stripe.Invoice;
    const sub = invoice.parent?.subscription_details?.subscription;
    subscriptionId = typeof sub === "string" ? sub : (sub?.id ?? null);
  }
  if (!subscriptionId) return false;
  await assertExpectedStripeAccount();
  // Relecture Stripe : les événements peuvent arriver hors ordre.
  const subscription = await getMarketplaceStripeClient().subscriptions.retrieve(subscriptionId);
  if (subscription.metadata.activity !== "workshop_subscription") return false;
  const binderId = subscription.metadata.binder_id;
  const item = subscription.items.data[0];
  if (
    subscription.items.data.length !== 1 ||
    item.price.lookup_key !== WORKSHOP_PRICE_LOOKUP_KEY ||
    item.quantity !== 1 ||
    item.price.currency !== "eur" ||
    item.price.unit_amount !== 1500 ||
    item.price.tax_behavior !== "exclusive" ||
    item.price.recurring?.interval !== "month" ||
    item.price.recurring.interval_count !== 1
  )
    throw new Error("workshop_subscription_price_mismatch");
  const customer =
    subscription.customer_account ??
    (typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id);
  const latestInvoiceId =
    typeof subscription.latest_invoice === "string"
      ? subscription.latest_invoice
      : subscription.latest_invoice?.id;
  const invoiceId = event.type.startsWith("invoice.")
    ? (object as Stripe.Invoice).id
    : typeof subscription.latest_invoice === "string"
      ? subscription.latest_invoice
      : subscription.latest_invoice?.id;
  const invoice = invoiceId
    ? await getMarketplaceStripeClient().invoices.retrieve(invoiceId)
    : null;
  const latestInvoice =
    invoice?.id === latestInvoiceId
      ? invoice
      : latestInvoiceId
        ? await getMarketplaceStripeClient().invoices.retrieve(latestInvoiceId)
        : null;
  for (const checkedInvoice of [invoice, latestInvoice]) {
    if (!checkedInvoice) continue;
    const invoiceCustomer =
      checkedInvoice.customer_account ??
      (typeof checkedInvoice.customer === "string"
        ? checkedInvoice.customer
        : checkedInvoice.customer?.id);
    const invoiceSub = checkedInvoice.parent?.subscription_details?.subscription;
    if (
      invoiceCustomer !== customer ||
      (typeof invoiceSub === "string" ? invoiceSub : invoiceSub?.id) !== subscription.id ||
      checkedInvoice.currency !== "eur" ||
      (checkedInvoice.subtotal_excluding_tax ?? checkedInvoice.subtotal) !== 1500 ||
      (checkedInvoice.status === "paid" &&
        (checkedInvoice.total < 1500 ||
          checkedInvoice.amount_paid !== checkedInvoice.total ||
          (checkedInvoice.amount_paid_off_stripe ?? 0) > 0))
    )
      throw new Error("workshop_subscription_invoice_mismatch");
    if (subscription.metadata.tax_decision === WORKSHOP_TAX_DECISION.id &&
        (checkedInvoice.total !== 1800 || checkedInvoice.automatic_tax?.enabled ||
         checkedInvoice.total - checkedInvoice.subtotal_excluding_tax! !== 300))
      throw new Error("workshop_subscription_vat_mismatch");
  }
  if (
    ["active", "trialing"].includes(subscription.status) &&
    (!latestInvoice || latestInvoice.status !== "paid")
  )
    throw new Error("workshop_subscription_payment_not_verified");
  // The hosted portal can schedule cancel_at instead of setting cancel_at_period_end.
  // Preserve that effective end date and never extend paid rights beyond it.
  const scheduledCancellation =
    subscription.cancel_at_period_end || typeof subscription.cancel_at === "number";
  const effectivePeriodEnd = Math.min(
    item.current_period_end,
    subscription.cancel_at ?? item.current_period_end,
  );
  const { error } = await sb.rpc("marketplace_sync_workshop_subscription", {
    p_binder_id: binderId,
    p_event_created: event.created,
    p_snapshot: {
      id: subscription.id,
      customer,
      status: subscription.status,
      period_end: new Date(effectivePeriodEnd * 1000).toISOString(),
      cancel_at_period_end: scheduledCancellation,
    },
  });
  if (error) throw error;
  if (invoice?.status) {
    const saved = await sb.from("marketplace_workshop_billing_documents").upsert({
      stripe_invoice_id: invoice.id,
      binder_id: binderId,
      stripe_subscription_id: subscription.id,
      number: invoice.number,
      status: invoice.status,
      currency: invoice.currency,
      total_cents: invoice.total,
      paid_cents: invoice.amount_paid,
      invoice_url: invoice.hosted_invoice_url,
      pdf_url: invoice.invoice_pdf,
      issued_at: new Date(invoice.created * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (saved.error) throw saved.error;
    if (
      event.type === "invoice.paid" ||
      (event.type === "invoice.payment_failed" && invoice.id === latestInvoiceId)
    ) {
      const paid = invoice.status === "paid";
      await notifyWorkshop(sb, {
        id: `subscription-${invoice.id}-${paid ? "paid" : "failed"}`,
        binderId,
        heading: paid
          ? "Votre facture d’abonnement est disponible"
          : "Votre paiement d’abonnement demande une action",
        intro: paid
          ? "Le paiement est enregistré. Votre facture est disponible dans votre espace atelier."
          : "Vérifiez votre moyen de paiement dans le portail Stripe de votre atelier.",
      });
    }
  }
  if (
    event.type === "customer.subscription.deleted" ||
    (event.type === "customer.subscription.updated" && scheduledCancellation)
  ) {
    await notifyWorkshop(sb, {
      id: `subscription-${subscription.id}-cancel-${subscription.status === "canceled" ? "effective" : "scheduled"}-${effectivePeriodEnd}`,
      binderId,
      heading: "Résiliation de votre abonnement",
      intro:
        subscription.status === "canceled"
          ? "Votre abonnement est terminé. Vos documents historiques restent consultables et téléchargeables."
          : `Votre abonnement se termine le ${new Date(effectivePeriodEnd * 1000).toLocaleDateString("fr-FR")}. Vos documents historiques restent conservés.`,
    });
  }
  return true;
}
