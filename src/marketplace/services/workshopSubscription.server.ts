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
  if (process.env.WORKSHOP_SUBSCRIPTION_TAX_APPROVED !== "true")
    fail(503, "La configuration fiscale de l’abonnement reste à valider.");
  await assertExpectedStripeAccount();
  const stripe = getMarketplaceStripeClient();
  const { data: prices } = await stripe.prices.list({
    lookup_keys: [WORKSHOP_PRICE_LOOKUP_KEY],
    active: true,
    limit: 2,
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
    if (existing.status === "open" && existing.url) return { url: existing.url };
    fail(409, "Le paiement est en cours de rapprochement. Réessayez dans quelques instants.");
  }
  let customer = reserved.stripe_customer_id;
  if (!customer) {
    const created = await stripe.customers.create(
      { metadata: { binder_id: binderId, activity: "workshop_subscription" } },
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
  };
  const origin = workshopOrigin();
  const session = await stripe.checkout.sessions.create(
    {
      customer,
      mode: "subscription",
      line_items: [{ price: price.id, quantity: 1 }],
      automatic_tax: { enabled: true },
      billing_address_collection: "required",
      customer_update: { address: "auto", name: "auto" },
      tax_id_collection: { enabled: true },
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
    .eq("binder_id", binderId);
  if (saved.error) throw saved.error;
  if (!session.url) throw new Error("checkout_url_missing");
  return { url: session.url };
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
  // Relecture Stripe : les événements peuvent arriver hors ordre.
  const subscription = await getMarketplaceStripeClient().subscriptions.retrieve(subscriptionId);
  if (subscription.metadata.activity !== "workshop_subscription") return false;
  const binderId = subscription.metadata.binder_id;
  const item = subscription.items.data[0];
  if (
    subscription.items.data.length !== 1 ||
    item.price.lookup_key !== WORKSHOP_PRICE_LOOKUP_KEY ||
    item.quantity !== 1
  )
    throw new Error("workshop_subscription_price_mismatch");
  const { error } = await sb.rpc("marketplace_sync_workshop_subscription", {
    p_binder_id: binderId,
    p_event_created: event.created,
    p_snapshot: {
      id: subscription.id,
      customer:
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id,
      status: subscription.status,
      period_end: new Date(item.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
    },
  });
  if (error) throw error;
  return true;
}
