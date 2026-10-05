/**
 * Facture de l'atelier à Oppe et règlement (activité A). L'atelier dépose ou génère sa facture
 * une fois le travail terminé ; l'administration la contrôle puis enregistre le virement. Les
 * règles (montant = rémunération acceptée, doublons, plafond du règlement, accès entre ateliers)
 * sont dans la base : ce fichier authentifie, prépare le PDF et traduit les refus.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin, assertAdmin, type Supa } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import { renderDocumentPdf } from "@/marketplace/quotes/documentPdf";
import { loadBillingProfile } from "./binderQuotes.server";
import { profileReadiness } from "@/marketplace/quotes/quoteBuild";
import { supplierInvoiceDocument, supplierInvoiceNumber } from "@/marketplace/invoices/supplierInvoice";
import { findActiveBinderMembership } from "./binderMembership.server";

const BUCKET = "supplier-invoices-private";
const MAX_PDF_BYTES = 3_500_000;

const REFUSALS: Record<string, string> = {
  forbidden: "Cette commande n'est pas affectée à votre atelier.",
  order_not_found: "Aucune commande payée pour ce dossier.",
  supplier_invoice_requires_completed_order: "Vous facturez Oppe une fois le travail terminé : marquez la commande terminée d'abord.",
  supplier_invoice_date_invalid: "La date de la facture ne peut pas être dans le futur.",
  admin_required: "Seule l'administration peut faire cela.",
  supplier_invoice_not_found: "Facture introuvable.",
  supplier_invoice_not_reviewable: "Cette facture a déjà été examinée.",
  supplier_rejection_reason_required: "Motivez le refus en une phrase.",
  supplier_invoice_not_accepted: "Acceptez la facture (conforme) avant d'enregistrer un règlement.",
  supplier_payment_amount_invalid: "Le montant du règlement doit être positif.",
  supplier_payment_date_invalid: "La date du règlement ne peut pas être dans le futur.",
  supplier_payment_exceeds_invoice: "Le règlement dépasse ce qui reste dû sur la facture.",
  marketplace_oppe_supplier_payments_reference_uniq: "Cette référence de virement est déjà enregistrée.",
  marketplace_oppe_supplier_invoices_number_uniq: "Une facture portant ce numéro existe déjà pour votre atelier.",
  marketplace_oppe_supplier_invoices_one_live: "Une facture existe déjà pour cette commande.",
};

function refuse(message: string | undefined): never {
  const key = Object.keys(REFUSALS).find((code) => (message ?? "").includes(code));
  fail(409, key ? REFUSALS[key] : "L'opération n'a pas pu aboutir.");
}

async function requireBinder(sb: Supa, userId: string): Promise<string> {
  const membership = await findActiveBinderMembership(sb, userId);
  if (!membership) fail(403, "Aucun atelier n'est associé à ce compte.");
  return membership!.binderId;
}

const vatFields = {
  vatRegime: z.enum(["FRANCHISE", "VAT_LIABLE"]),
  vatRateBps: z.number().int().min(0).max(3000).nullable(),
  vatMention: z.string().trim().max(300).nullable(),
};

function checkVat(input: { vatRegime: string; vatRateBps: number | null; vatMention: string | null }) {
  if (input.vatRegime === "FRANCHISE" && !(input.vatMention ?? "").trim()) fail(422, "En franchise en base, indiquez la mention de TVA (art. 293 B du CGI).");
  if (input.vatRegime === "VAT_LIABLE" && input.vatRateBps === null) fail(422, "Indiquez le taux de TVA de votre facture.");
}

async function assignmentContext(sb: Supa, caseId: string) {
  const { data: assignment, error } = await sb
    .from("marketplace_oppe_order_assignments")
    .select("id, binder_id, payout_cents, service_description")
    .eq("case_id", caseId)
    .is("ended_at", null)
    .maybeSingle();
  if (error) throw error;
  const { data: row } = await sb.from("marketplace_cases").select("reference").eq("id", caseId).maybeSingle();
  return { assignment, reference: row?.reference ?? caseId.slice(0, 8) };
}

function dueDate(issueDate: string): string {
  const d = new Date(`${issueDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 30);
  return d.toISOString().slice(0, 10);
}

async function store(sb: Supa, binderId: string, caseId: string, bytes: Uint8Array): Promise<string> {
  const path = `${binderId}/${caseId}/${crypto.randomUUID()}.pdf`;
  const { error } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: "application/pdf", upsert: false });
  if (error) fail(500, "Le document n'a pas pu être enregistré.");
  return path;
}

async function submit(
  sb: Supa,
  userId: string,
  input: { caseId: string; binderId: string; source: "tool" | "external"; number: string; issueDate: string; vatRegime: string; vatRateBps: number | null; vatMention: string | null; path: string },
) {
  const { data, error } = await sb.rpc("marketplace_submit_supplier_invoice", {
    p_case: input.caseId, p_binder: input.binderId, p_source: input.source, p_number: input.number, p_issue_date: input.issueDate,
    p_vat_regime: input.vatRegime, p_vat_rate_bps: input.vatRateBps as never, p_vat_mention: input.vatMention as never,
    p_document_path: input.path, p_actor: userId,
  });
  if (error) {
    await sb.storage.from(BUCKET).remove([input.path]);
    refuse(error.message);
  }
  return data as string;
}

const caseInput = z.object({ caseId: z.string().uuid() });

/** Facture générée par l'outil, au nom de l'atelier, adressée à OPPE SAS. */
export const createSupplierInvoiceFromTool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ caseId: z.string().uuid(), issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), ...vatFields }).strict().parse(data),
  )
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const binderId = await requireBinder(sb, context.userId);
    checkVat(data);
    const { assignment, reference } = await assignmentContext(sb, data.caseId);
    if (!assignment || assignment.binder_id !== binderId) refuse("forbidden");
    const profile = await loadBillingProfile(sb, binderId);
    const readiness = profileReadiness(profile, "invoice");
    if (!readiness.ready) fail(422, `Complétez votre profil de facturation : ${readiness.missing.join(", ")}.`);
    const vatCents = data.vatRegime === "FRANCHISE" ? 0 : Math.round((assignment!.payout_cents * (data.vatRateBps ?? 0)) / 10_000);
    const number = supplierInvoiceNumber(profile, reference);
    const pdf = await renderDocumentPdf(
      supplierInvoiceDocument({
        profile, number, issueDate: data.issueDate, dueDate: dueDate(data.issueDate), caseReference: reference,
        serviceDescription: assignment!.service_description, amountHtCents: assignment!.payout_cents,
        vatRegime: data.vatRegime, vatRateBps: data.vatRateBps, vatCents, vatMention: data.vatMention,
      }),
    );
    const path = await store(sb, binderId, data.caseId, Uint8Array.from(atob(pdf.base64), (c) => c.charCodeAt(0)));
    const id = await submit(sb, context.userId, { caseId: data.caseId, binderId, source: "tool", number, issueDate: data.issueDate, vatRegime: data.vatRegime, vatRateBps: data.vatRateBps, vatMention: data.vatMention, path });
    return { id, number };
  });

/** Facture externe : le PDF de l'atelier, déposé tel quel. Le montant vient de l'accord, jamais du PDF. */
export const uploadExternalSupplierInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      caseId: z.string().uuid(),
      number: z.string().trim().min(1).max(60),
      issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      pdfBase64: z.string().min(100).max(5_000_000),
      ...vatFields,
    }).strict().parse(data),
  )
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const binderId = await requireBinder(sb, context.userId);
    checkVat(data);
    const bytes = Uint8Array.from(atob(data.pdfBase64), (c) => c.charCodeAt(0));
    if (bytes.length > MAX_PDF_BYTES) fail(413, "Le PDF dépasse 3,5 Mo.");
    if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") fail(422, "Le fichier n'est pas un PDF.");
    const { assignment } = await assignmentContext(sb, data.caseId);
    if (!assignment || assignment.binder_id !== binderId) refuse("forbidden");
    const path = await store(sb, binderId, data.caseId, bytes);
    const id = await submit(sb, context.userId, { caseId: data.caseId, binderId, source: "external", number: data.number, issueDate: data.issueDate, vatRegime: data.vatRegime, vatRateBps: data.vatRateBps, vatMention: data.vatMention, path });
    return { id };
  });

const rowFields =
  "id, source, invoice_number, issue_date, due_date, amount_ht_cents, vat_regime, vat_rate_bps, vat_cents, amount_ttc_cents, status, review_reason, document_path, created_at, binder_id";

async function withPayments(sb: Supa, invoices: { id: string; amount_ttc_cents: number }[]) {
  if (invoices.length === 0) return new Map<string, { paid: number; list: { id: string; paid_on: string; amount_cents: number; reference: string }[] }>();
  const { data, error } = await sb.from("marketplace_oppe_supplier_payments").select("id, invoice_id, paid_on, amount_cents, reference").in("invoice_id", invoices.map((i) => i.id)).order("paid_on");
  if (error) throw error;
  const map = new Map<string, { paid: number; list: { id: string; paid_on: string; amount_cents: number; reference: string }[] }>();
  for (const p of data ?? []) {
    const entry = map.get(p.invoice_id) ?? { paid: 0, list: [] };
    entry.paid += p.amount_cents;
    entry.list.push({ id: p.id, paid_on: p.paid_on, amount_cents: p.amount_cents, reference: p.reference });
    map.set(p.invoice_id, entry);
  }
  return map;
}

/** L'atelier : sa facture pour cette commande, son état et son échéance. */
export const getMySupplierInvoice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => caseInput.parse(data))
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const binderId = await requireBinder(sb, context.userId);
    const { data: invoices, error } = await sb.from("marketplace_oppe_supplier_invoices").select(rowFields).eq("case_id", data.caseId).eq("binder_id", binderId).order("created_at");
    if (error) throw error;
    const payments = await withPayments(sb, invoices ?? []);
    return (invoices ?? []).map(({ document_path: _path, binder_id: _binder, ...rest }) => ({ ...rest, paidCents: payments.get(rest.id)?.paid ?? 0, payments: payments.get(rest.id)?.list ?? [] }));
  });

/** L'administration : toutes les factures de l'atelier pour la commande, avec règlements. */
export const getSupplierInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => caseInput.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data: invoices, error } = await sb.from("marketplace_oppe_supplier_invoices").select(rowFields).eq("case_id", data.caseId).order("created_at");
    if (error) throw error;
    const payments = await withPayments(sb, invoices ?? []);
    return (invoices ?? []).map(({ document_path: _path, ...rest }) => ({ ...rest, paidCents: payments.get(rest.id)?.paid ?? 0, payments: payments.get(rest.id)?.list ?? [] }));
  });

export const reviewSupplierInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ invoiceId: z.string().uuid(), decision: z.enum(["accepted", "rejected"]), reason: z.string().trim().max(500).nullable().default(null) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data: result, error } = await sb.rpc("marketplace_review_supplier_invoice", { p_invoice: data.invoiceId, p_decision: data.decision, p_reason: (data.reason ?? "") as never, p_actor: context.userId });
    if (error) refuse(error.message);
    return { status: result };
  });

export const recordSupplierPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      invoiceId: z.string().uuid(),
      paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      amountCents: z.number().int().positive(),
      reference: z.string().trim().min(3).max(120),
    }).strict().parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data: result, error } = await sb.rpc("marketplace_record_supplier_payment", {
      p_invoice: data.invoiceId, p_paid_on: data.paidOn, p_amount: data.amountCents, p_reference: data.reference, p_actor: context.userId,
    });
    if (error) refuse(error.message);
    return { status: result };
  });

/** Lien signé de courte durée vers le PDF : à l'atelier propriétaire, ou à l'administration. */
export const getSupplierInvoiceLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ invoiceId: z.string().uuid(), asAdmin: z.boolean().default(false) }).parse(data))
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const { data: invoice, error } = await sb.from("marketplace_oppe_supplier_invoices").select("document_path, binder_id").eq("id", data.invoiceId).maybeSingle();
    if (error) throw error;
    if (!invoice) fail(404, "Facture introuvable.");
    if (data.asAdmin) await assertAdmin(context.supabase, context.userId);
    else if ((await requireBinder(sb, context.userId)) !== invoice!.binder_id) fail(404, "Facture introuvable.");
    const { data: signed, error: signError } = await sb.storage.from(BUCKET).createSignedUrl(invoice!.document_path, 300);
    if (signError || !signed) fail(500, "Le lien n'a pas pu être créé.");
    return { url: signed!.signedUrl };
  });
