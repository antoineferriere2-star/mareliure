import type Stripe from "stripe";
import type { Supa } from "@/build/services/adminAuth.server";
import { assertExpectedStripeAccount, getMarketplaceStripeClient } from "./stripeClient.server";
import { workshopOrigin } from "@/marketplace/billing/workshopSubscription";
import { hashAccessToken, generateAccessToken } from "@/build/services/dossierAccessToken.server";

export async function createWorkshopInvoicePaymentLink(
  sb: Supa,
  binderId: string,
  invoiceId: string,
) {
  const token = generateAccessToken();
  const result = await sb.rpc("marketplace_reserve_workshop_online_payment", {
    p_binder_id: binderId,
    p_invoice_id: invoiceId,
    p_token_hash: await hashAccessToken(token),
    p_expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
  });
  if (result.error) throw result.error;
  const row = result.data as { token_hash: string; id: string; status: string };
  if (row.token_hash !== (await hashAccessToken(token))) {
    const rotated = await sb
      .from("marketplace_workshop_online_payments")
      .update({
        token_hash: hashAccessToken(token),
        token_expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
      })
      .eq("id", row.id)
      .eq("status", "ready")
      .is("checkout_session_id", null)
      .select("id")
      .single();
    if (rotated.error) throw new Error("payment_link_already_in_use");
  }
  return { url: `${workshopOrigin()}/reglement-atelier/${token}` };
}

export async function paymentByToken(sb: Supa, token: string) {
  const result = await sb
    .from("marketplace_workshop_online_payments")
    .select("*")
    .eq("token_hash", await hashAccessToken(token))
    .gt("token_expires_at", new Date().toISOString())
    .single();
  if (result.error || !result.data) throw new Error("payment_link_unavailable");
  return result.data;
}

export async function assertWorkshopDirectChargeAccount(accountId: string) {
  await assertExpectedStripeAccount();
  const account = await getMarketplaceStripeClient().accounts.retrieve(accountId);
  if (
    !account.charges_enabled ||
    !account.payouts_enabled ||
    account.controller?.fees?.payer !== "account" ||
    account.controller?.losses?.payments !== "stripe"
  ) {
    throw new Error("connect_direct_charge_account_required");
  }
  return account;
}

export async function createWorkshopInvoiceCheckout(sb: Supa, token: string) {
  const row = await paymentByToken(sb, token);
  await assertWorkshopDirectChargeAccount(row.stripe_account_id);
  const stripe = getMarketplaceStripeClient();
  if (row.checkout_session_id) {
    const previous = await stripe.checkout.sessions.retrieve(
      row.checkout_session_id,
      {},
      { stripeAccount: row.stripe_account_id },
    );
    if (previous.status === "open" && previous.url) return { url: previous.url };
    // Un Checkout complété peut rester asynchrone : ne jamais ouvrir un second encaissement.
    if (previous.status === "complete") throw new Error("payment_pending_reconciliation");
  }
  const result = await sb.rpc("marketplace_reserve_workshop_payment_checkout", {
    p_payment_id: row.id,
  });
  if (result.error) throw result.error;
  const reserved = result.data as {
    checkout_session_id: string | null;
    checkout_expires_at: string;
  };
  const options = { stripeAccount: row.stripe_account_id };
  if (reserved.checkout_session_id) {
    const existing = await stripe.checkout.sessions.retrieve(
      reserved.checkout_session_id,
      {},
      options,
    );
    if (existing.status === "open" && existing.url) return { url: existing.url };
    throw new Error("payment_pending_reconciliation");
  }
  const invoice = await sb
    .from("marketplace_binder_invoices")
    .select("invoice_number, client_email")
    .eq("id", row.invoice_id)
    .eq("binder_id", row.binder_id)
    .single();
  if (invoice.error) throw invoice.error;
  const metadata = {
    activity: "workshop_online_payment",
    payment_id: row.id,
    binder_id: row.binder_id,
    invoice_id: row.invoice_id,
  };
  const url = `${workshopOrigin()}/reglement-atelier/${token}`;
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      customer_email: invoice.data.client_email ?? undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: row.currency,
            unit_amount: row.amount_cents,
            product_data: { name: `Facture atelier ${invoice.data.invoice_number}` },
          },
        },
      ],
      payment_intent_data: { application_fee_amount: row.fee_cents, metadata },
      metadata,
      success_url: `${url}?payment=returned`,
      cancel_url: url,
      expires_at: Math.floor(Date.parse(reserved.checkout_expires_at) / 1000),
    },
    { ...options, idempotencyKey: `workshop-invoice-${row.id}-${reserved.checkout_expires_at}` },
  );
  const saved = await sb
    .from("marketplace_workshop_online_payments")
    .update({ checkout_session_id: session.id })
    .eq("id", row.id);
  if (saved.error) throw saved.error;
  if (!session.url) throw new Error("checkout_url_missing");
  return { url: session.url };
}

export async function refundWorkshopInvoice(
  sb: Supa,
  binderId: string,
  paymentId: string,
  creditId: string,
) {
  const payment = await sb
    .from("marketplace_workshop_online_payments")
    .select("*")
    .eq("id", paymentId)
    .eq("binder_id", binderId)
    .single();
  if (payment.error) throw payment.error;
  const p = payment.data;
  if (!p.payment_intent_id) throw new Error("payment_not_received");
  await assertExpectedStripeAccount();
  const reserved = await sb.rpc("marketplace_reserve_workshop_refund", {
    p_binder_id: binderId,
    p_payment_id: paymentId,
    p_credit_note_id: creditId,
  });
  if (reserved.error) throw reserved.error;
  const r = reserved.data as { amount_cents: number; stripe_refund_id: string | null };
  if (r.stripe_refund_id) return { id: r.stripe_refund_id };
  // Une réponse perdue peut dépasser la durée de rétention des clés d'idempotence Stripe.
  // Rechercher aussi la preuve du remboursement avant de refaire une écriture.
  for await (const prior of getMarketplaceStripeClient().refunds.list(
    { payment_intent: p.payment_intent_id, limit: 100 },
    { stripeAccount: p.stripe_account_id },
  )) {
    if (prior.metadata?.credit_note_id === creditId) {
      const saved = await sb
        .from("marketplace_workshop_online_refunds")
        .update({ stripe_refund_id: prior.id })
        .eq("credit_note_id", creditId);
      if (saved.error) throw saved.error;
      return { id: prior.id };
    }
  }
  const refund = await getMarketplaceStripeClient().refunds.create(
    {
      payment_intent: p.payment_intent_id,
      amount: r.amount_cents,
      refund_application_fee: true,
      metadata: { credit_note_id: creditId, payment_id: paymentId },
    },
    { stripeAccount: p.stripe_account_id, idempotencyKey: `workshop-refund-${creditId}` },
  );
  const saved = await sb
    .from("marketplace_workshop_online_refunds")
    .update({ stripe_refund_id: refund.id })
    .eq("credit_note_id", creditId);
  if (saved.error) throw saved.error;
  return { id: refund.id };
}

export async function processWorkshopConnectEvent(sb: Supa, event: Stripe.Event) {
  if (!event.account) throw new Error("connect_event_account_required");
  const stripe = getMarketplaceStripeClient();
  const options = { stripeAccount: event.account };
  let intentId: string | null = null;
  const object = event.data.object;
  if (event.type.startsWith("checkout.session.")) {
    const session = object as Stripe.Checkout.Session;
    if (session.metadata?.activity !== "workshop_online_payment") return;
    const paymentId = session.metadata.payment_id;
    const row = await sb
      .from("marketplace_workshop_online_payments")
      .select("*")
      .eq("id", paymentId)
      .eq("stripe_account_id", event.account)
      .single();
    if (row.error) throw row.error;
    // Relire la session réellement réservée, jamais un montant fourni par le navigateur.
    if (row.data.checkout_session_id !== session.id) throw new Error("connect_session_mismatch");
    intentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null);
    if (!intentId) return;
  } else if (event.type.startsWith("payment_intent.")) {
    const intent = object as Stripe.PaymentIntent;
    if (intent.metadata.activity !== "workshop_online_payment") return;
    intentId = intent.id;
  } else if (event.type === "charge.refunded" || event.type.startsWith("charge.dispute.")) {
    const disputeCharge = (object as Stripe.Dispute).charge;
    const chargeId =
      event.type === "charge.refunded"
        ? (object as Stripe.Charge).id
        : typeof disputeCharge === "string"
          ? disputeCharge
          : disputeCharge.id;
    const charge = await stripe.charges.retrieve(chargeId, {}, options);
    intentId =
      typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : (charge.payment_intent?.id ?? null);
  } else return;
  if (!intentId) return;
  const intent = await stripe.paymentIntents.retrieve(
    intentId,
    { expand: ["latest_charge.balance_transaction"] },
    options,
  );
  if (intent.metadata.activity !== "workshop_online_payment") return;
  const row = await sb
    .from("marketplace_workshop_online_payments")
    .select("*")
    .eq("id", intent.metadata.payment_id)
    .eq("stripe_account_id", event.account)
    .single();
  if (row.error) throw row.error;
  const p = row.data;
  if (!p.checkout_session_id) throw new Error("connect_session_missing");
  const session = await stripe.checkout.sessions.retrieve(p.checkout_session_id, {}, options);
  const sessionIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (
    sessionIntent !== intent.id ||
    intent.currency !== p.currency ||
    intent.amount !== p.amount_cents ||
    (intent.status === "succeeded" && intent.amount_received !== p.amount_cents) ||
    intent.application_fee_amount !== p.fee_cents ||
    intent.metadata.invoice_id !== p.invoice_id ||
    intent.metadata.binder_id !== p.binder_id
  )
    throw new Error("connect_payment_mismatch");
  const charge = typeof intent.latest_charge === "object" ? intent.latest_charge : null;
  const balance =
    charge && typeof charge.balance_transaction === "object" ? charge.balance_transaction : null;
  const stripeFees =
    balance?.fee_details
      .filter((fee) => fee.type === "stripe_fee")
      .reduce((total, fee) => total + fee.amount, 0) ?? null;
  const refunded = charge?.amount_refunded ?? 0;
  const refunds = await sb
    .from("marketplace_workshop_online_refunds")
    .select("amount_cents")
    .eq("payment_id", p.id);
  if (refunds.error) throw refunds.error;
  const accounted = (refunds.data ?? []).reduce((total, r) => total + r.amount_cents, 0);
  const patch = {
    payment_intent_id: intent.id,
    status:
      intent.status === "succeeded"
        ? refunded >= p.amount_cents
          ? "refunded"
          : "paid"
        : intent.status === "processing"
          ? "processing"
          : "failed",
    ...(intent.status === "succeeded"
      ? { paid_at: p.paid_at ?? new Date(event.created * 1000).toISOString() }
      : {}),
    refunded_cents: refunded,
    disputed: charge?.disputed ?? false,
    stripe_fee_cents: stripeFees,
    reconciliation_required: refunded > accounted,
    updated_at: new Date().toISOString(),
  };
  const saved = await sb
    .from("marketplace_workshop_online_payments")
    .update(patch)
    .eq("id", p.id)
    .lte("refunded_cents", refunded);
  if (saved.error) throw saved.error;
}
