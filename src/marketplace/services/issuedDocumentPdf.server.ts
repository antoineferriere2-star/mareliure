/**
 * PDF des pièces émises (factures et avoirs d'atelier) : produit une seule fois, rangé dans un bucket privé
 * avec son empreinte SHA-256, puis toujours resservi tel quel — jamais régénéré. La base n'accepte d'écrire
 * `pdf_path` / `pdf_sha256` qu'une fois (migration 20261023100000).
 *
 * Une pièce émise avant cette version, ou dont le rangement a échoué au moment de l'émission, est rangée à
 * son premier téléchargement : à partir de là, c'est ce fichier qui fait foi.
 */
import type { Supa } from "@/build/services/adminAuth.server";
import type { CreditNoteDocumentView, DocumentView } from "@/marketplace/quotes/quoteViews";
import { renderDocumentPdf } from "@/marketplace/quotes/documentPdf";

export const ISSUED_DOCUMENTS_BUCKET = "binder-issued-documents";

type IssuedDocument = DocumentView | CreditNoteDocumentView;
type Kind = "invoice" | "credit_note";

export class IssuedPdfIntegrityError extends Error {
  constructor(readonly path: string) {
    super("issued_pdf_integrity");
  }
}

const tableOf = (kind: Kind) =>
  kind === "invoice" ? "marketplace_binder_invoices" : "marketplace_binder_credit_notes";

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};
const fromBase64 = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

function kindOf(doc: IssuedDocument): Kind {
  if (doc.kind === "invoice") return "invoice";
  if (doc.kind === "credit_note") return "credit_note";
  throw new Error("issued_pdf_kind");
}

async function storedRow(sb: Supa, kind: Kind, binderId: string, id: string) {
  const { data, error } = await sb
    .from(tableOf(kind))
    .select("pdf_path, pdf_sha256")
    .eq("id", id)
    .eq("binder_id", binderId)
    .maybeSingle();
  if (error || !data) throw error ?? new Error("issued_pdf_document_not_found");
  return data as { pdf_path: string | null; pdf_sha256: string | null };
}

async function download(sb: Supa, path: string): Promise<Uint8Array | null> {
  const { data, error } = await sb.storage.from(ISSUED_DOCUMENTS_BUCKET).download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

/**
 * Range le PDF d'une pièce émise s'il ne l'est pas encore et renvoie les octets qui font foi.
 * Si un fichier existe déjà au chemin prévu (rangement interrompu après l'envoi), c'est lui qui est retenu.
 */
export async function storeIssuedPdf(sb: Supa, binderId: string, doc: IssuedDocument): Promise<Uint8Array> {
  const kind = kindOf(doc);
  if (doc.status === "draft") throw new Error("issued_pdf_draft");
  const row = await storedRow(sb, kind, binderId, doc.id);
  if (row.pdf_path) return readStored(sb, row.pdf_path, row.pdf_sha256!);

  const path = `${binderId}/${kind}/${doc.id}.pdf`;
  let bytes = await download(sb, path);
  if (!bytes) {
    bytes = fromBase64((await renderDocumentPdf(doc)).base64);
    const { error } = await sb.storage
      .from(ISSUED_DOCUMENTS_BUCKET)
      .upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (error) {
      // Course entre deux premiers téléchargements : le fichier de l'autre requête fait foi.
      bytes = await download(sb, path);
      if (!bytes) throw error;
    }
  }
  const sha = await sha256Hex(bytes);
  const { data: written, error } = await sb
    .from(tableOf(kind))
    .update({ pdf_path: path, pdf_sha256: sha })
    .eq("id", doc.id)
    .eq("binder_id", binderId)
    .is("pdf_path", null)
    .select("id");
  if (error) throw error;
  if (!written?.length) {
    const again = await storedRow(sb, kind, binderId, doc.id);
    if (!again.pdf_path) throw new Error("issued_pdf_not_recorded");
    return readStored(sb, again.pdf_path, again.pdf_sha256!);
  }
  return bytes;
}

async function readStored(sb: Supa, path: string, sha: string): Promise<Uint8Array> {
  const bytes = await download(sb, path);
  if (!bytes || (await sha256Hex(bytes)) !== sha) throw new IssuedPdfIntegrityError(path);
  return bytes;
}

/** Ce que sert tout téléchargement d'une facture ou d'un avoir émis. */
export async function issuedPdfBase64(sb: Supa, binderId: string, doc: IssuedDocument): Promise<string> {
  return toBase64(await storeIssuedPdf(sb, binderId, doc));
}

/** Rangement au moment de l'émission : un échec n'annule jamais l'émission, le premier téléchargement reprendra. */
export async function storeIssuedPdfQuietly(sb: Supa, binderId: string, doc: IssuedDocument): Promise<void> {
  try {
    await storeIssuedPdf(sb, binderId, doc);
  } catch (error) {
    console.error("issued_pdf_store_failed", { kind: doc.kind, id: doc.id, error: String(error) });
  }
}
