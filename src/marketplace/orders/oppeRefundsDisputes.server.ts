/**
 * Remboursements et litiges des commandes Oppe, tels que Stripe les annonce (webhook vérifié).
 *
 * - `charge.refunded` : le statut des remboursements créés par l'application est rapproché ; un
 *   remboursement fait hors de l'application (tableau de bord Stripe) est signalé à
 *   l'administration, qui émet l'avoir correspondant : jamais un avoir deviné.
 * - `charge.dispute.*` : le litige est enregistré et suivi ; l'administration est prévenue.
 *
 * Idempotent : un événement rejoué réécrit le même état.
 */
import type { Supa } from "@/build/services/adminAuth.server";

interface RefundLike { id: string; status?: string | null; amount?: number | null; metadata?: Record<string, string> | null }
interface ChargeLike { id: string; payment_intent?: string | { id: string } | null; refunds?: { data?: RefundLike[] } | null }
interface DisputeLike {
  id: string; payment_intent?: string | { id: string } | null; amount?: number | null; currency?: string | null;
  reason?: string | null; status?: string | null; evidence_details?: { due_by?: number | null } | null;
}

const idOf = (value: string | { id: string } | null | undefined) => (typeof value === "string" ? value : value?.id ?? null);

async function caseForPaymentIntent(sb: Supa, paymentIntentId: string | null): Promise<string | null> {
  if (!paymentIntentId) return null;
  const { data: payment } = await sb
    .from("marketplace_commercial_proposal_payments")
    .select("proposal_id")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();
  if (!payment) return null;
  const { data: proposal } = await sb.from("marketplace_commercial_proposals").select("case_id").eq("id", payment.proposal_id).maybeSingle();
  return proposal?.case_id ?? null;
}

const refundStatus = (status: string | null | undefined) =>
  status === "succeeded" ? "succeeded" : status === "failed" ? "failed" : status === "canceled" ? "canceled" : "pending";

export async function handleChargeRefunded(sb: Supa, charge: ChargeLike): Promise<void> {
  const caseId = await caseForPaymentIntent(sb, idOf(charge.payment_intent));
  if (!caseId) return; // Pas une commande Oppe (autre activité sur le compte, ou paiement historique).
  for (const refund of charge.refunds?.data ?? []) {
    const { data: rows, error } = await sb
      .from("marketplace_oppe_refunds")
      .update({ status: refundStatus(refund.status), updated_at: new Date().toISOString() })
      .eq("stripe_refund_id", refund.id)
      .select("id");
    if (error) throw error;
    if ((rows ?? []).length === 0) {
      const { caseReference, notifyAdmin } = await import("@/marketplace/notifications/adminAlerts.server");
      const { reference } = await caseReference(sb, caseId);
      await notifyAdmin({
        caseId,
        heading: `Remboursement hors application — ${reference}`,
        intro: `Stripe signale un remboursement de ${((refund.amount ?? 0) / 100).toFixed(2)} € sur la commande ${reference}, fait hors de l'application. Émettez l'avoir correspondant depuis la facturation du dossier.`,
        idempotencyKey: `external-refund-${refund.id}`,
      });
    } else if (refund.status === "failed") {
      const { caseReference, notifyAdmin } = await import("@/marketplace/notifications/adminAlerts.server");
      const { reference } = await caseReference(sb, caseId);
      await notifyAdmin({
        caseId,
        heading: `Remboursement échoué — ${reference}`,
        intro: `Le remboursement ${refund.id} de la commande ${reference} a échoué chez Stripe. L'avoir est émis : remboursez le client par un autre moyen et conservez la preuve.`,
        idempotencyKey: `refund-failed-${refund.id}`,
      });
    }
  }
}

export async function handleDispute(sb: Supa, dispute: DisputeLike): Promise<void> {
  const caseId = await caseForPaymentIntent(sb, idOf(dispute.payment_intent));
  if (!caseId) return;
  const { error } = await sb.from("marketplace_oppe_disputes").upsert({
    stripe_dispute_id: dispute.id,
    case_id: caseId,
    payment_intent_id: idOf(dispute.payment_intent),
    amount_cents: dispute.amount ?? null,
    currency: dispute.currency ?? null,
    reason: dispute.reason ?? null,
    status: dispute.status ?? "unknown",
    evidence_due_by: dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "stripe_dispute_id" });
  if (error) throw error;
  const { caseReference, notifyAdmin } = await import("@/marketplace/notifications/adminAlerts.server");
  const { reference } = await caseReference(sb, caseId);
  await notifyAdmin({
    caseId,
    heading: `Litige de paiement — ${reference} (${dispute.status ?? "ouvert"})`,
    intro: `Le client a contesté le paiement de la commande ${reference} auprès de sa banque (motif : ${dispute.reason ?? "non précisé"}). Répondez depuis le tableau de bord Stripe avant l'échéance indiquée.`,
    idempotencyKey: `dispute-${dispute.id}-${dispute.status ?? "open"}`,
  });
}
