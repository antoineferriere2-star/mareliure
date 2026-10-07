import type Stripe from "stripe";
import type { Supa } from "@/build/services/adminAuth.server";
import { assertExpectedStripeAccount, getMarketplaceStripeClient } from "./stripeClient.server";
import { workshopOrigin } from "@/marketplace/billing/workshopSubscription";
import { hashAccessToken, generateAccessToken } from "@/build/services/dossierAccessToken.server";
import {
  readWorkshopConnectAccount,
  refreshWorkshopConnectAccountById,
} from "./binderConnect.server";
import { inspectWorkshopCheckout, recoverWorkshopCheckout } from "./checkoutRecovery.server";
import { notifyWorkshop } from "@/marketplace/notifications/workshopNotices.server";
import { openWorkshopPaymentToken, sealWorkshopPaymentToken } from "./workshopPaymentToken.server";
import type { MarketplaceBrand } from "@/marketplace/brand/brandConfig";
import { issueWorkshopFeeDocuments } from "@/marketplace/services/workshopFeeDocuments.server";
import { WORKSHOP_SUBSCRIPTION_TERMS } from "@/marketplace/billing/workshopSubscription";

export async function createWorkshopInvoicePaymentLink(
  sb: Supa,
  binderId: string,
  invoiceId: string,
  brand: MarketplaceBrand = "MA_RELIURE",
) {
  if (!process.env.WORKSHOP_PAYMENT_LINK_KEY) throw new Error("workshop_payment_link_key_missing");
  const existing = await sb.from("marketplace_workshop_online_payments").select("id,sealed_token")
    .eq("binder_id", binderId).eq("invoice_id", invoiceId).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data?.sealed_token) return restoreWorkshopPaymentLink(sb, binderId, existing.data.id, existing.data.sealed_token);
  const token = generateAccessToken();
  const result = await sb.rpc("marketplace_reserve_workshop_online_payment", {
    p_binder_id: binderId,
    p_invoice_id: invoiceId,
    p_token_hash: await hashAccessToken(token),
    p_expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
  });
  if (result.error) throw result.error;
  const row = result.data as { token_hash: string; id: string; status: string; sealed_token: string | null };
  const marked = await sb.from("marketplace_workshop_online_payments").update({ fee_brand: brand })
    .eq("id", row.id).eq("token_hash", row.token_hash).is("paid_at", null).is("checkout_session_id", null);
  if (marked.error) throw marked.error;
  if (!row.sealed_token) {
    const sealed = await sealWorkshopPaymentToken(token, binderId, row.id);
    const rotated = await sb
      .from("marketplace_workshop_online_payments")
      .update({
        token_hash: hashAccessToken(token),
        token_expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
        sealed_token: sealed,
      })
      .eq("id", row.id)
      .eq("status", "ready")
      .eq("token_hash", row.token_hash)
      .is("sealed_token", null)
      .is("checkout_session_id", null)
      .select("id")
      .maybeSingle();
    if (rotated.error) throw rotated.error;
  }
  const stored = await sb.from("marketplace_workshop_online_payments").select("sealed_token")
    .eq("id", row.id).eq("binder_id", binderId).single();
  if (stored.error) throw stored.error;
  if (!stored.data.sealed_token) throw new Error("payment_link_already_in_use");
  return restoreWorkshopPaymentLink(sb, binderId, row.id, stored.data.sealed_token);
}
async function restoreWorkshopPaymentLink(sb: Supa, binderId: string, paymentId: string, sealed: string) {
  const access = await openWorkshopPaymentToken(sealed, binderId, paymentId);
  const extended = await sb.from("marketplace_workshop_online_payments")
    .update({ token_expires_at: new Date(Date.now() + 30 * 86400_000).toISOString() }).eq("id", paymentId).eq("binder_id", binderId);
  if (extended.error) throw extended.error;
  return { url: `${workshopOrigin()}/reglement-atelier/${access}` };
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
  const status = await readWorkshopConnectAccount(accountId);
  if (!status.onboarded) {
    throw new Error("connect_direct_charge_account_required");
  }
  return status.account;
}

export async function createWorkshopInvoiceCheckout(sb: Supa, token: string) {
  const settings = await sb.from("marketplace_workshop_offer_settings").select("online_payment_open").eq("id", true).single();
  if (settings.error) throw settings.error;
  if (!settings.data.online_payment_open) throw new Error("online_payment_closed");
  if (process.env.WORKSHOP_CONNECT_TERMS_READY !== WORKSHOP_SUBSCRIPTION_TERMS)
    throw new Error("workshop_online_payment_terms_not_ready");
  const row = await paymentByToken(sb, token);
  if (row.paid_at || !["ready", "failed"].includes(row.status))
    throw new Error("payment_pending_reconciliation");
  await assertWorkshopDirectChargeAccount(row.stripe_account_id);
  const stripe = getMarketplaceStripeClient();
  const options = { stripeAccount: row.stripe_account_id };
  if (!row.checkout_session_id && row.checkout_expires_at) {
    const recovered = await recoverWorkshopCheckout(
      stripe,
      row.checkout_expires_at,
      { activity: "workshop_online_payment", payment_id: row.id },
      options,
    );
    if (recovered) {
      const saved = await sb
        .from("marketplace_workshop_online_payments")
        .update({ checkout_session_id: recovered.id })
        .eq("id", row.id)
        .eq("checkout_expires_at", row.checkout_expires_at)
        .is("checkout_session_id", null);
      if (saved.error) throw saved.error;
      // Reload after compare-and-set; a concurrent request may have already saved it.
      return createWorkshopInvoiceCheckout(sb, token);
    }
  }
  if (row.checkout_session_id) {
    const previous = await inspectWorkshopCheckout(stripe, row.checkout_session_id, options);
    if (previous.kind === "open") return { url: previous.url };
    const released = await sb.rpc("marketplace_release_workshop_payment_checkout", {
      p_payment_id: row.id,
      p_session_id: row.checkout_session_id,
      p_intent_id: previous.intentId,
      p_reason: previous.reason,
    });
    if (released.error) throw released.error;
  }
  const result = await sb.rpc("marketplace_reserve_workshop_payment_checkout", {
    p_payment_id: row.id,
  });
  if (result.error) throw result.error;
  const reserved = result.data as {
    checkout_session_id: string | null;
    checkout_expires_at: string;
  };
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
      integration_identifier: "oppe_workshop_payment_kqynvtaz",
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
      payment_intent_data: {
        application_fee_amount: row.fee_cents,
        metadata,
        receipt_email: invoice.data.client_email ?? undefined,
      },
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
    .eq("id", row.id)
    .eq("checkout_expires_at", reserved.checkout_expires_at)
    .is("checkout_session_id", null);
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
  let r = reserved.data as {
    amount_cents: number;
    stripe_refund_id: string | null;
    generation: number;
  };
  if (r.stripe_refund_id) {
    const previous = await getMarketplaceStripeClient().refunds.retrieve(
      r.stripe_refund_id,
      {},
      { stripeAccount: p.stripe_account_id },
    );
    if (!["failed", "canceled"].includes(previous.status ?? "")) return { id: previous.id };
    const priorIntent =
      typeof previous.payment_intent === "string"
        ? previous.payment_intent
        : previous.payment_intent?.id;
    if (
      previous.amount !== r.amount_cents ||
      previous.currency !== p.currency ||
      priorIntent !== p.payment_intent_id ||
      previous.metadata?.credit_note_id !== creditId ||
      previous.metadata.payment_id !== p.id
    )
      throw new Error("workshop_refund_mismatch");
    const released = await sb.rpc("marketplace_retry_workshop_refund", {
      p_binder_id: binderId,
      p_credit_note_id: creditId,
      p_refund_id: previous.id,
      p_status: previous.status!,
    });
    if (released.error) throw released.error;
    const current = await sb
      .from("marketplace_workshop_online_refunds")
      .select("*")
      .eq("credit_note_id", creditId)
      .eq("payment_id", p.id)
      .single();
    if (current.error) throw current.error;
    r = current.data;
    if (r.stripe_refund_id) return { id: r.stripe_refund_id };
  }
  // Une réponse perdue peut dépasser la durée de rétention des clés d'idempotence Stripe.
  // Rechercher aussi la preuve du remboursement avant de refaire une écriture.
  for await (const prior of getMarketplaceStripeClient().refunds.list(
    { payment_intent: p.payment_intent_id, limit: 100 },
    { stripeAccount: p.stripe_account_id },
  )) {
    if (
      prior.metadata?.credit_note_id === creditId &&
      !["failed", "canceled"].includes(prior.status ?? "")
    ) {
      const saved = await sb
        .from("marketplace_workshop_online_refunds")
        .update({ stripe_refund_id: prior.id, status: prior.status ?? "pending" })
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
    {
      stripeAccount: p.stripe_account_id,
      idempotencyKey: `workshop-refund-${creditId}${r.generation ? `-retry-${r.generation}` : ""}`,
    },
  );
  const saved = await sb
    .from("marketplace_workshop_online_refunds")
    .update({ stripe_refund_id: refund.id, status: refund.status ?? "pending" })
    .eq("credit_note_id", creditId);
  if (saved.error) throw saved.error;
  return { id: refund.id };
}

/** Platform fee refunds can arrive after the connected charge refund. Re-read
 * the actual fee and charge so the later return also emits its credit note. */
export async function processWorkshopPlatformFeeEvent(sb: Supa, event: Stripe.Event): Promise<boolean> {
  if (event.account || !["application_fee.refunded", "application_fee.refund.updated"].includes(event.type)) return false;
  await assertExpectedStripeAccount();
  const stripe = getMarketplaceStripeClient();
  const refund = event.data.object as Stripe.FeeRefund;
  const feeId = event.type === "application_fee.refunded" ? event.data.object.id :
    typeof refund.fee === "string" ? refund.fee : refund.fee?.id;
  if (!feeId) throw new Error("connect_fee_event_missing_fee");
  const fee = await stripe.applicationFees.retrieve(feeId);
  const account = typeof fee.account === "string" ? fee.account : fee.account.id;
  const chargeId = typeof fee.charge === "string" ? fee.charge : fee.charge.id;
  const charge = await stripe.charges.retrieve(chargeId, { expand: ["payment_intent"] }, { stripeAccount: account });
  const intent = charge.payment_intent;
  const verifiedIntent = typeof intent === "string" ? await stripe.paymentIntents.retrieve(intent, {}, { stripeAccount: account }) : intent;
  if (verifiedIntent?.metadata.activity !== "workshop_online_payment") return false;
  await processWorkshopConnectEvent(sb, { ...event, account, type: "charge.refunded", data: { object: charge } });
  return true;
}

export async function processWorkshopConnectEvent(sb: Supa, event: Stripe.Event) {
  if (!event.account) throw new Error("connect_event_account_required");
  await assertExpectedStripeAccount();
  if (event.type === "account.updated") {
    await refreshWorkshopConnectAccountById(sb, event.account);
    return;
  }
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
    if (row.data.checkout_session_id !== session.id) {
      const prior = await sb
        .from("marketplace_workshop_checkout_attempts")
        .select("checkout_session_id")
        .eq("payment_id", row.data.id)
        .eq("checkout_session_id", session.id)
        .maybeSingle();
      if (prior.error) throw prior.error;
      if (prior.data) return;
      throw new Error("connect_session_mismatch");
    }
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
  const prior = await sb
    .from("marketplace_workshop_checkout_attempts")
    .select("payment_intent_id")
    .eq("payment_id", p.id)
    .eq("payment_intent_id", intent.id)
    .maybeSingle();
  if (prior.error) throw prior.error;
  if (prior.data) {
    if (intent.status !== "canceled") throw new Error("archived_payment_requires_reconciliation");
    return;
  }
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
  let feeRefunded: number | null = p.fee_refunded_cents;
  let verifiedFeeId: string | null = null;
  if (charge?.application_fee) {
    const fee =
      typeof charge.application_fee === "string"
        ? await stripe.applicationFees.retrieve(charge.application_fee)
        : charge.application_fee;
    if (
      fee.amount !== p.fee_cents ||
      fee.currency !== p.currency ||
      (typeof fee.account === "string" ? fee.account : fee.account.id) !== event.account
    )
      throw new Error("connect_fee_mismatch");
    feeRefunded = fee.amount_refunded;
    verifiedFeeId = fee.id;
  }
  // Stripe peut publier la réussite avant que les frais d'application soient lisibles.
  // Le webhook sera repris ; ne projeter aucun règlement ni frais de l'ancienne tentative.
  if (intent.status === "succeeded" && p.fee_tax_basis === "vat_inclusive_fr_20" &&
    p.fee_cents > 0 && !verifiedFeeId) throw new Error("connect_collected_fee_not_verified");
  let disputed = false;
  let disputeLost = false;
  const disputeStates: string[] = [];
  if (charge?.disputed || event.type.startsWith("charge.dispute.")) {
    for await (const dispute of stripe.disputes.list(
      { payment_intent: intent.id, limit: 100 },
      options,
    )) {
      if (dispute.currency !== p.currency) throw new Error("connect_dispute_mismatch");
      disputed ||= [
        "needs_response",
        "under_review",
        "warning_needs_response",
        "warning_under_review",
      ].includes(dispute.status);
      disputeLost ||= dispute.status === "lost";
      disputeStates.push(`${dispute.id}-${dispute.status}`);
      const saved = await sb.from("marketplace_workshop_online_disputes").upsert({
        stripe_dispute_id: dispute.id,
        payment_id: p.id,
        status: dispute.status,
        amount_cents: dispute.amount,
        currency: dispute.currency,
        reason: dispute.reason,
        evidence_due_at: dispute.evidence_details.due_by
          ? new Date(dispute.evidence_details.due_by * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      });
      if (saved.error) throw saved.error;
    }
  }
  const refunds = await sb
    .from("marketplace_workshop_online_refunds")
    .select("amount_cents")
    .eq("payment_id", p.id);
  if (refunds.error) throw refunds.error;
  let accounted = 0;
  if (refunded > 0) {
    // Match actual refunds to issued credit notes; a reservation is never a refund receipt.
    for await (const refund of stripe.refunds.list(
      { payment_intent: intent.id, limit: 100 },
      options,
    )) {
      const metadata = refund.metadata;
      if (
        refund.status !== "succeeded" ||
        refund.currency !== p.currency ||
        metadata?.payment_id !== p.id ||
        !metadata.credit_note_id
      )
        continue;
      const credit = await sb
        .from("marketplace_workshop_online_refunds")
        .select("amount_cents,stripe_refund_id")
        .eq("payment_id", p.id)
        .eq("credit_note_id", metadata.credit_note_id)
        .maybeSingle();
      if (credit.error) throw credit.error;
      if (
        !credit.data ||
        credit.data.amount_cents !== refund.amount ||
        (credit.data.stripe_refund_id && credit.data.stripe_refund_id !== refund.id)
      )
        continue;
      const saved = await sb
        .from("marketplace_workshop_online_refunds")
        .update({ stripe_refund_id: refund.id, status: refund.status ?? "pending" })
        .eq("credit_note_id", metadata.credit_note_id)
        .eq("payment_id", p.id);
      if (saved.error) throw saved.error;
      accounted += refund.amount;
    }
  }
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
    disputed,
    fee_refunded_cents: feeRefunded,
    receipt_url: charge?.receipt_url ?? p.receipt_url,
    stripe_fee_cents: stripeFees ?? p.stripe_fee_cents,
    reconciliation_required: refunded > accounted || disputeLost,
    updated_at: new Date().toISOString(),
  };
  const saved = await sb
    .from("marketplace_workshop_online_payments")
    .update(patch)
    .eq("id", p.id)
    .eq("checkout_session_id", p.checkout_session_id)
    .lte("refunded_cents", refunded)
    .select("id")
    .maybeSingle();
  if (saved.error) throw saved.error;
  if (!saved.data) return;
  if (intent.status === "succeeded" && p.fee_tax_basis === "vat_inclusive_fr_20") {
    await issueWorkshopFeeDocuments(sb, p, verifiedFeeId, feeRefunded ?? 0);
  }
  if (
    patch.status === "paid" ||
    patch.status === "refunded" ||
    patch.disputed ||
    patch.status === "failed"
  ) {
    await notifyWorkshop(sb, {
      id: `payment-${p.id}-${intent.id}-${patch.status}-${refunded}-${patch.disputed}-${disputeStates.sort().join("_")}`,
      binderId: p.binder_id,
      brand: p.fee_brand === "FINE_BINDERY" ? "FINE_BINDERY" : "MA_RELIURE",
      heading: disputeLost
        ? "Litige clos : rapprochement à vérifier"
        : patch.disputed
          ? "Litige sur un paiement client"
          : refunded > 0
            ? "Remboursement client enregistré"
            : patch.status === "paid"
              ? "Paiement client confirmé"
              : "Paiement client échoué",
      intro: disputeLost
        ? "Le litige est clos en faveur du client. Le rapprochement comptable demande une vérification."
        : patch.disputed
          ? "Consultez le litige dans votre espace Stripe. Le remboursement est suspendu pendant son traitement."
          : patch.reconciliation_required
            ? "Le remboursement Stripe demande un rapprochement avec un avoir dans votre atelier."
            : patch.status === "failed"
              ? "Votre client peut reprendre le paiement après vérification de la tentative Stripe."
              : "Le solde de la facture et les frais de paiement sont mis à jour dans votre espace atelier.",
    });
  }
}
