/**
 * Facturation des commandes Oppe (activité A) : facture, avoirs, remboursements, litiges,
 * frais Stripe et marges. Le client lit et télécharge ses propres documents ; l'administration
 * voit tout, rembourse et suit les litiges. Aucun montant ne vient jamais du navigateur sauf le
 * montant d'un remboursement décidé par l'administration, borné par la base.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin, assertAdmin, type Supa } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import { renderDocumentPdf } from "@/marketplace/quotes/documentPdf";
import {
  oppeCreditNoteDocument,
  oppeInvoiceDocument,
  type OppeCreditNoteRecord,
  type OppeInvoiceItemRecord,
  type OppeInvoiceRecord,
} from "@/marketplace/invoices/oppeInvoice";

async function loadInvoice(sb: Supa, caseId: string) {
  const { data: invoice, error } = await sb.from("marketplace_oppe_invoices").select("*").eq("case_id", caseId).maybeSingle();
  if (error) throw error;
  if (!invoice) return null;
  const [{ data: items, error: iError }, { data: notes, error: nError }] = await Promise.all([
    sb.from("marketplace_oppe_invoice_items").select("*").eq("invoice_id", invoice.id).order("position"),
    sb.from("marketplace_oppe_credit_notes").select("*").eq("invoice_id", invoice.id).order("issued_at"),
  ]);
  if (iError) throw iError;
  if (nError) throw nError;
  return {
    invoice: invoice as unknown as OppeInvoiceRecord & { proposal_id: string; case_id: string },
    items: (items ?? []) as unknown as OppeInvoiceItemRecord[],
    notes: (notes ?? []) as unknown as OppeCreditNoteRecord[],
  };
}

const summary = (loaded: NonNullable<Awaited<ReturnType<typeof loadInvoice>>>) => ({
  invoice: { id: loaded.invoice.id, number: loaded.invoice.number, issueDate: loaded.invoice.issue_date, totalTtcCents: loaded.invoice.total_ttc_cents },
  creditNotes: loaded.notes.map((n) => ({ id: n.id, number: n.number, issueDate: n.issue_date, totalTtcCents: n.total_ttc_cents, reason: n.reason })),
  creditedTtcCents: loaded.notes.reduce((sum, n) => sum + n.total_ttc_cents, 0),
});

async function assertCaseOwner(sb: Supa, caseId: string, userId: string) {
  const { data, error } = await sb.from("marketplace_cases").select("customer_user_id").eq("id", caseId).maybeSingle();
  if (error) throw error;
  if (!data || data.customer_user_id !== userId) fail(403, "Ce dossier n'est pas le vôtre.");
}

const caseInput = z.object({ caseId: z.string().uuid() });

/** Le client : sa facture et ses avoirs, rien d'autre. */
export const getMyOppeDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => caseInput.parse(data))
  .handler(async ({ context, data }) => {
    const sb = await admin();
    await assertCaseOwner(sb, data.caseId, context.userId);
    const loaded = await loadInvoice(sb, data.caseId);
    return loaded ? summary(loaded) : null;
  });

const downloadInput = z.object({ caseId: z.string().uuid(), documentId: z.string().uuid() });

async function renderOppeDocument(sb: Supa, caseId: string, documentId: string) {
  const loaded = await loadInvoice(sb, caseId);
  if (!loaded) fail(404, "Aucune facture pour ce dossier.");
  if (loaded!.invoice.id === documentId) {
    const pdf = await renderDocumentPdf(oppeInvoiceDocument(loaded!.invoice, loaded!.items));
    return { fileName: `${loaded!.invoice.number}.pdf`, base64: pdf.base64 };
  }
  const note = loaded!.notes.find((n) => n.id === documentId);
  if (!note) fail(404, "Document introuvable.");
  const pdf = await renderDocumentPdf(oppeCreditNoteDocument(loaded!.invoice, note!));
  return { fileName: `${note!.number}.pdf`, base64: pdf.base64 };
}

export const downloadMyOppeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => downloadInput.parse(data))
  .handler(async ({ context, data }) => {
    const sb = await admin();
    await assertCaseOwner(sb, data.caseId, context.userId);
    return renderOppeDocument(sb, data.caseId, data.documentId);
  });

export const downloadOppeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => downloadInput.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    return renderOppeDocument(await admin(), data.caseId, data.documentId);
  });

/** L'administration : documents, remboursements, litiges, frais et marges de la commande. */
export const getOppeBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => caseInput.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const loaded = await loadInvoice(sb, data.caseId);
    if (!loaded) return null;
    const proposalId = loaded.invoice.proposal_id;
    const [{ data: refunds }, { data: disputes }, { data: payment }, { data: proposal }, { data: assignment }] = await Promise.all([
      sb.from("marketplace_oppe_refunds").select("id, amount_cents, reason, status, stripe_refund_id, created_at").eq("case_id", data.caseId).order("created_at"),
      sb.from("marketplace_oppe_disputes").select("stripe_dispute_id, amount_cents, reason, status, evidence_due_by").eq("case_id", data.caseId),
      sb.from("marketplace_commercial_proposal_payments").select("stripe_fee_cents, stripe_net_cents, stripe_payment_intent_id").eq("proposal_id", proposalId).maybeSingle(),
      sb.from("marketplace_commercial_proposals").select("customer_service_price_cents, binder_payout_cents").eq("id", proposalId).single(),
      sb.from("marketplace_oppe_order_assignments").select("payout_cents").eq("case_id", data.caseId).is("ended_at", null).maybeSingle(),
    ]);
    // Marge brute : prix de vente HT de la prestation moins le coût atelier en vigueur (réattribution
    // comprise) ; marge après frais : moins les frais Stripe réels du paiement. Transport exclu.
    const payout = assignment?.payout_cents ?? proposal?.binder_payout_cents ?? 0;
    const grossMarginCents = (proposal?.customer_service_price_cents ?? 0) - payout;
    const stripeFeeCents = payment?.stripe_fee_cents ?? null;
    return {
      ...summary(loaded),
      refunds: refunds ?? [],
      disputes: disputes ?? [],
      economics: {
        servicePriceHtCents: proposal?.customer_service_price_cents ?? null,
        workshopCostHtCents: payout,
        grossMarginCents,
        stripeFeeCents,
        marginAfterFeesCents: stripeFeeCents === null ? null : grossMarginCents - stripeFeeCents,
        netReceivedCents: payment?.stripe_net_cents ?? null,
      },
    };
  });

/**
 * Remboursement partiel ou total : Stripe d'abord (clé d'idempotence par demande), puis l'avoir
 * correspondant, ventilé par la base sur les lignes et les taux de la facture.
 */
export const refundOppeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ caseId: z.string().uuid(), amountCents: z.number().int().positive(), reason: z.string().trim().min(5).max(500), requestKey: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const loaded = await loadInvoice(sb, data.caseId);
    if (!loaded) fail(404, "Aucune facture pour ce dossier : rien à rembourser.");
    const remaining = loaded!.invoice.total_ttc_cents - summary(loaded!).creditedTtcCents;
    if (data.amountCents > remaining) fail(409, `Le remboursement dépasse ce qui reste de la facture (${(remaining / 100).toFixed(2)} €).`);
    const { data: payment } = await sb
      .from("marketplace_commercial_proposal_payments")
      .select("stripe_payment_intent_id")
      .eq("proposal_id", loaded!.invoice.proposal_id)
      .maybeSingle();
    if (!payment?.stripe_payment_intent_id) fail(409, "Paiement Stripe introuvable pour cette commande.");

    const idempotencyKey = `oppe-refund-${data.requestKey}`;
    const { data: existing } = await sb.from("marketplace_oppe_refunds").select("id, status, credit_note_id").eq("idempotency_key", idempotencyKey).maybeSingle();
    if (existing?.credit_note_id) return { refundId: existing.id, status: existing.status, alreadyDone: true };
    let refundRowId = existing?.id;
    if (!refundRowId) {
      const { data: row, error } = await sb.from("marketplace_oppe_refunds").insert({
        case_id: data.caseId, invoice_id: loaded!.invoice.id, amount_cents: data.amountCents, currency: loaded!.invoice.currency.toLowerCase(),
        reason: data.reason, requested_by: context.userId, idempotency_key: idempotencyKey,
      }).select("id").single();
      if (error) fail(500, error.message);
      refundRowId = row!.id;
    }
    const { getMarketplaceStripeClient } = await import("@/marketplace/stripe/stripeClient.server");
    const refund = await getMarketplaceStripeClient().refunds.create(
      { payment_intent: payment!.stripe_payment_intent_id!, amount: data.amountCents, metadata: { case_id: data.caseId, invoice_id: loaded!.invoice.id, refund_row_id: refundRowId! } },
      { idempotencyKey },
    );
    const status = refund.status === "succeeded" ? "succeeded" : refund.status === "failed" ? "failed" : refund.status === "canceled" ? "canceled" : "pending";
    let creditNoteId: string | null = null;
    if (status !== "failed" && status !== "canceled") {
      const { data: noteId, error: noteError } = await sb.rpc("marketplace_issue_oppe_credit_note", {
        p_invoice_id: loaded!.invoice.id, p_amount_ttc_cents: data.amountCents, p_reason: data.reason,
      });
      if (noteError) fail(500, noteError.message);
      creditNoteId = noteId as string;
    }
    await sb.from("marketplace_oppe_refunds").update({ stripe_refund_id: refund.id, status, credit_note_id: creditNoteId, updated_at: new Date().toISOString() }).eq("id", refundRowId!);
    await sb.from("marketplace_events").insert({
      case_id: data.caseId, actor_user_id: context.userId, event_type: "oppe_refund_created",
      metadata: { refund_id: refund.id, amount_cents: data.amountCents, status, credit_note_id: creditNoteId },
    });
    return { refundId: refundRowId!, status, alreadyDone: false };
  });
