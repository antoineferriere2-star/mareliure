/**
 * Journal chaîné des émetteurs (chaque atelier, et OPPE) : vérification d'intégrité, export d'archives,
 * événements de l'application et modèle d'attestation. La chaîne elle-même est tenue par la base
 * (migration 20261024100000) ; ce module ne fait que la lire, la faire clore et la faire compléter.
 */
import type { Supa } from "@/build/services/adminAuth.server";
import { todayInParis } from "@/marketplace/quotes/quoteStatus";
import { oppeCreditNoteDocument, oppeInvoiceDocument, type OppeCreditNoteRecord, type OppeInvoiceItemRecord,
  type OppeInvoiceRecord } from "@/marketplace/invoices/oppeInvoice";
import { buildIssuerArchive, isPiece, pdfFileName, pieceOf, type JournalRow } from "@/marketplace/ledger/archive";
import { getCreditNote, getInvoice } from "./binderQuotes.server";
import { IssuedPdfIntegrityError, storeIssuedPdf, storeOppeIssuedPdf } from "./issuedDocumentPdf.server";
import { workshopFeeDocumentView } from "./workshopFeeDocuments.server";

export const OPPE_ISSUER = "oppe";
export const binderIssuer = (binderId: string) => `binder:${binderId}`;
export const SOFTWARE_VERSION = (import.meta.env.VITE_BUILD_COMMIT as string | undefined) ?? "inconnu";

export type { IntegrityProblem, IntegrityReport } from "@/marketplace/ledger/integrity";
import type { IntegrityReport } from "@/marketplace/ledger/integrity";

async function rpcOrThrow<T>(promise: PromiseLike<{ data: unknown; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data as T;
}

/** Rattrape les clôtures échues de l'émetteur (la tâche planifiée les fait aussi chaque nuit). */
export const closeDuePeriods = (sb: Supa, issuer: string) =>
  rpcOrThrow<number>(sb.rpc("marketplace_journal_close_due", { p_issuer: issuer }));

export async function verifyIssuer(sb: Supa, issuer: string): Promise<IntegrityReport> {
  await closeDuePeriods(sb, issuer);
  return rpcOrThrow<IntegrityReport>(sb.rpc("marketplace_journal_verify", { p_issuer: issuer }));
}

export async function recordJournalEvent(
  sb: Supa,
  issuer: string,
  event: "export" | "pdf_integrity_failure" | "modification_refused" | "attestation_draft",
  payload: Record<string, unknown>,
  actorId: string | null,
): Promise<string> {
  return rpcOrThrow<string>(sb.rpc("marketplace_journal_record_event", {
    p_issuer: issuer, p_event: event, p_payload: payload as never, p_actor: actorId,
  }));
}

/** Tentative de modification d'une pièce figée, refusée par l'application ou par la base : elle reste datée. */
export async function recordModificationRefused(sb: Supa, issuer: string, detail: { action: string; document_id?: string; reason: string },
  actorId: string | null) {
  try {
    await recordJournalEvent(sb, issuer, "modification_refused", detail, actorId);
  } catch (error) {
    console.error(JSON.stringify({ event: "modification_refused_journal_failed", issuer, error: String(error) }));
  }
}

// ---------------------------------------------------------------------------------------------
// Export d'archives
// ---------------------------------------------------------------------------------------------

export interface ArchivePeriod {
  year: number;
  /** 1 à 12 ; absent : l'année entière. */
  month: number | null;
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function periodBounds({ year, month }: ArchivePeriod) {
  const pad = (n: number) => String(n).padStart(2, "0");
  if (month === null) return { start: `${year}-01-01`, end: `${year + 1}-01-01`, label: `année ${year}`, slug: `${year}` };
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`;
  return { start: `${year}-${pad(month)}-01`, end: next, label: `${MONTHS[month - 1]} ${year}`, slug: `${year}-${pad(month)}` };
}

const parisDayOf = (iso: string) => todayInParis(new Date(iso));
const dayBefore = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString();
const dayAfter = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString();

async function issuerLabel(sb: Supa, issuer: string): Promise<string> {
  if (issuer === OPPE_ISSUER) return "OPPE SAS";
  const { data } = await sb.from("marketplace_binder_billing_profiles").select("legal_name, workshop_name, siren")
    .eq("binder_id", issuer.slice("binder:".length)).maybeSingle();
  const name = data?.legal_name || data?.workshop_name || "Atelier";
  return data?.siren ? `${name} — SIREN ${data.siren}` : name;
}

const SUPPLIER_INVOICES_BUCKET = "supplier-invoices-private";

async function pdfOf(sb: Supa, issuer: string, entry: JournalRow): Promise<Uint8Array> {
  const id = entry.document_id!;
  if (entry.document_kind === "supplier_invoice") {
    // Le document remis à OPPE, tel que déposé (outil ou PDF externe de l'atelier).
    const { data, error } = await sb.storage.from(SUPPLIER_INVOICES_BUCKET).download(String(entry.payload.document_path));
    if (error || !data) throw error ?? new Error("supplier_invoice_document_missing");
    return new Uint8Array(await data.arrayBuffer());
  }
  if (entry.document_kind === "oppe_fee_document") {
    const { data: row, error } = await sb.from("marketplace_workshop_fee_documents").select("*").eq("id", id).maybeSingle();
    if (error || !row) throw error ?? new Error("fee_document_not_found");
    const original = row.invoice_document_id
      ? (await sb.from("marketplace_workshop_fee_documents").select("*").eq("id", row.invoice_document_id).maybeSingle()).data ?? undefined
      : undefined;
    return storeOppeIssuedPdf(sb, "oppe_fee_document", id, workshopFeeDocumentView(row, original));
  }
  if (entry.document_kind === "binder_invoice" || entry.document_kind === "binder_credit_note") {
    const binderId = issuer.slice("binder:".length);
    const doc = entry.document_kind === "binder_invoice" ? await getInvoice(sb, binderId, id) : await getCreditNote(sb, binderId, id);
    return storeIssuedPdf(sb, binderId, doc);
  }
  if (entry.document_kind === "oppe_invoice") {
    const [{ data: invoice, error }, { data: items, error: itemsError }] = await Promise.all([
      sb.from("marketplace_oppe_invoices").select("*").eq("id", id).maybeSingle(),
      sb.from("marketplace_oppe_invoice_items").select("*").eq("invoice_id", id).order("position"),
    ]);
    if (error || itemsError || !invoice) throw error ?? itemsError ?? new Error("oppe_invoice_not_found");
    return storeOppeIssuedPdf(sb, "oppe_invoice", id,
      oppeInvoiceDocument(invoice as unknown as OppeInvoiceRecord, (items ?? []) as unknown as OppeInvoiceItemRecord[]));
  }
  const { data: note, error } = await sb.from("marketplace_oppe_credit_notes").select("*").eq("id", id).maybeSingle();
  if (error || !note) throw error ?? new Error("oppe_credit_note_not_found");
  const { data: invoice, error: invoiceError } = await sb.from("marketplace_oppe_invoices").select("*").eq("id", note.invoice_id).maybeSingle();
  if (invoiceError || !invoice) throw invoiceError ?? new Error("oppe_invoice_not_found");
  return storeOppeIssuedPdf(sb, "oppe_credit_note", id,
    oppeCreditNoteDocument(invoice as unknown as OppeInvoiceRecord, note as unknown as OppeCreditNoteRecord));
}

const JOURNAL_PAGE = 1000;

export async function exportIssuerArchive(sb: Supa, issuer: string, period: ArchivePeriod, actorId: string | null) {
  const bounds = periodBounds(period);
  await closeDuePeriods(sb, issuer);
  // Instantané : le dernier rang est capturé d'abord, puis le journal est lu page par page jusqu'à lui
  // (une lecture unique serait tronquée par la limite de réponse, sans que rien ne le signale).
  const { data: head, error: headError } = await sb.from("marketplace_issuer_journal").select("seq").eq("issuer_key", issuer)
    .order("seq", { ascending: false }).limit(1).maybeSingle();
  if (headError) throw headError;
  const lastSeq = Number(head?.seq ?? 0);
  const rows: JournalRow[] = [];
  for (let from = 0; ; from += JOURNAL_PAGE) {
    // Fenêtre élargie d'un jour de chaque côté, puis filtre sur le jour civil à Paris.
    const { data: page, error } = await sb.from("marketplace_issuer_journal").select("*").eq("issuer_key", issuer)
      .lte("seq", lastSeq).gte("occurred_at", dayBefore(bounds.start)).lt("occurred_at", dayAfter(bounds.end))
      .order("seq").range(from, from + JOURNAL_PAGE - 1);
    if (error) throw error;
    rows.push(...((page ?? []) as unknown as JournalRow[]));
    if (!page || page.length < JOURNAL_PAGE) break;
  }
  const entries = rows.filter((e) => {
    const day = parisDayOf(e.occurred_at);
    return day >= bounds.start && day < bounds.end;
  });
  let anchor: { seq: number; hash: string } | null = null;
  if (entries.length && entries[0].seq > 1) {
    const { data: before, error: anchorError } = await sb.from("marketplace_issuer_journal").select("seq, hash")
      .eq("issuer_key", issuer).eq("seq", entries[0].seq - 1).maybeSingle();
    if (anchorError) throw anchorError;
    anchor = before ? { seq: Number(before.seq), hash: before.hash } : null;
  }
  const { data: closureRows, error: closureError } = await sb.from("marketplace_issuer_journal").select("*").eq("issuer_key", issuer)
    .eq("event", "closure").gte("payload->>period_start", bounds.start).lte("payload->>period_end", bounds.end).order("seq");
  if (closureError) throw closureError;

  const pdfs: { name: string; bytes: Uint8Array }[] = [];
  const missingPdfs: { number: string; reason: string }[] = [];
  for (const entry of entries.filter(isPiece)) {
    const number = pieceOf(entry).number || String(entry.document_id);
    try {
      pdfs.push({ name: pdfFileName(number), bytes: await pdfOf(sb, issuer, entry) });
    } catch (pdfError) {
      missingPdfs.push({ number, reason: pdfError instanceof IssuedPdfIntegrityError
        ? "PDF rangé altéré ou absent (anomalie inscrite au journal)" : "PDF indisponible au moment de l'export" });
    }
  }
  const generatedAt = new Date();
  const built = await buildIssuerArchive({
    issuer: { key: issuer, label: await issuerLabel(sb, issuer) }, period: bounds, entries, anchor,
    closures: (closureRows ?? []) as unknown as JournalRow[], pdfs, missingPdfs, softwareVersion: SOFTWARE_VERSION, generatedAt,
  });
  await recordJournalEvent(sb, issuer, "export", {
    period_start: bounds.start, period_end: bounds.end, manifest_sha256: built.manifestSha256, files: built.fileCount,
    entries: entries.length, first_seq: entries[0]?.seq ?? null, last_seq: entries.at(-1)?.seq ?? null,
    chain_ok: built.chainOk, missing_pdfs: missingPdfs.length, software_version: SOFTWARE_VERSION,
  }, actorId);
  const issuerSlug = issuer === OPPE_ISSUER ? "oppe" : "atelier";
  return {
    filename: `archives-${issuerSlug}-${bounds.slug}.zip`,
    base64: toBase64(built.zip),
    manifestSha256: built.manifestSha256,
    entries: entries.length,
    missingPdfs: missingPdfs.length,
  };
}

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

// ---------------------------------------------------------------------------------------------
// Administration : émetteurs et modèle d'attestation
// ---------------------------------------------------------------------------------------------

export async function listIssuers(sb: Supa) {
  const rows = await rpcOrThrow<{ issuer_key: string; entries: number; last_seq: number; last_at: string }[]>(
    sb.rpc("marketplace_journal_issuers"));
  const issuers = rows.map((r) => ({ issuer: r.issuer_key, entries: Number(r.entries), lastAt: r.last_at }));
  return Promise.all(issuers.map(async (i) => ({ ...i, label: await issuerLabel(sb, i.issuer) })));
}

/**
 * Modèle d'attestation de l'éditeur pour un émetteur : un texte de travail, marqué brouillon, qui décrit
 * factuellement les mesures en place. Il n'est montré qu'à l'administration tant qu'Antoine ne l'a pas validé.
 */
export async function attestationDraft(sb: Supa, issuer: string, actorId: string) {
  const label = await issuerLabel(sb, issuer);
  const report = await verifyIssuer(sb, issuer);
  const today = todayInParis();
  const text = [
    "BROUILLON À VALIDER — NE PAS DIFFUSER",
    "",
    "Attestation individuelle de l'éditeur (modèle de travail)",
    "",
    "Éditeur : OPPE SAS, éditeur du logiciel Ma Reliure (espace atelier et facturation des commandes).",
    `Logiciel : Ma Reliure, version ${SOFTWARE_VERSION}.`,
    `Émetteur concerné : ${label} (${issuer}).`,
    `Date du modèle : ${today}.`,
    "",
    "Mesures en place dans le logiciel, à la date du modèle :",
    "1. Numérotation continue par émetteur, par type de pièce et par année, attribuée par la base de données à l'émission.",
    "2. Date d'émission imposée par le serveur (heure de Paris) ; une pièce émise n'est plus modifiable ni supprimable.",
    "3. PDF produit une seule fois à l'émission, rangé dans un stockage privé avec son empreinte SHA-256, puis resservi tel quel.",
    "4. Journal en ajout seul par émetteur : émissions, encaissements, PDF, changements de préfixe, clôtures, exports et anomalies,",
    "   chaque entrée portant l'empreinte SHA-256 de son contenu canonique et de l'entrée précédente.",
    "5. Clôtures journalières (jours d'activité), mensuelles et annuelles, chaînées, avec totaux HT, TVA par taux, TTC et encaissements par mode.",
    "6. Vérification d'intégrité à la demande et export d'archives par période (CSV, JSON, PDF, journal, clôtures, empreintes).",
    "",
    `État du journal au ${report.verified_at} : ${report.entries} entrée(s), ${report.ok ? "aucune anomalie détectée" : `${report.problems.length} anomalie(s) détectée(s)`}, dernière empreinte ${report.last_hash}.`,
    "",
    "[Engagements et références réglementaires : à rédiger et à valider avant toute diffusion.]",
    "",
    "Fait à [lieu], le [date]. Signature : [nom, qualité].",
  ].join("\n");
  await recordJournalEvent(sb, issuer, "attestation_draft", { software_version: SOFTWARE_VERSION, date: today, journal_last_hash: report.last_hash }, actorId);
  return { text, issuer, label };
}
