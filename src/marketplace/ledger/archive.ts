/**
 * Archive d'un émetteur pour une période : tout ce qu'il faut pour relire et prouver ses pièces sans
 * Ma Reliure — CSV, JSON, PDF rangés, journal chaîné, clôtures, et le fichier des empreintes de chaque
 * fichier. L'empreinte de ce dernier est inscrite au journal de l'émetteur (événement « export »).
 */
import { GENESIS_HASH, sha256HexOfText, verifyJournalChain } from "./journalChain";
import { zipStore, type ZipFile } from "./zip";

export interface JournalRow {
  issuer_key: string;
  seq: number;
  event: string;
  event_key: string;
  document_kind: string | null;
  document_id: string | null;
  occurred_at: string;
  actor: string | null;
  payload: Record<string, unknown>;
  canonical: string;
  prev_hash: string;
  hash: string;
}

export interface ArchiveInput {
  issuer: { key: string; label: string };
  period: { start: string; end: string; label: string };
  /** Entrées du journal de la période, dans l'ordre. */
  entries: readonly JournalRow[];
  /** L'entrée qui précède la première (pour vérifier le segment), ou aucune si la période ouvre le journal. */
  anchor: { seq: number; hash: string } | null;
  /** Clôtures portant sur la période (elles sont écrites après la fin de la période). */
  closures: readonly JournalRow[];
  pdfs: readonly { name: string; bytes: Uint8Array }[];
  /** Pièces dont le PDF n'a pas pu être joint, avec la raison. */
  missingPdfs: readonly { number: string; reason: string }[];
  softwareVersion: string;
  generatedAt: Date;
}

export interface BuiltArchive {
  zip: Uint8Array;
  manifestSha256: string;
  fileCount: number;
  chainOk: boolean;
}

const encoder = new TextEncoder();
const text = (value: string) => encoder.encode(value);

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** CSV au point-virgule (tableurs français), UTF-8 avec BOM, champs entre guillemets si besoin. */
export function toCsv(header: readonly string[], rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  const cell = (value: string | number | null | undefined) => {
    const s = value === null || value === undefined ? "" : String(value);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [header, ...rows].map((row) => row.map(cell).join(";")).join("\r\n") + "\r\n";
}

const euros = (cents: unknown) => (typeof cents === "number" ? (cents / 100).toFixed(2).replace(".", ",") : "");
const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));
const num = (value: unknown) => (typeof value === "number" ? value : Number(value ?? 0));

/** Numéro et date d'une pièce, quelle que soit la table d'origine. */
export function pieceOf(entry: JournalRow) {
  const p = entry.payload;
  const supplier = entry.document_kind === "supplier_invoice";
  const fee = entry.document_kind === "oppe_fee_document";
  const doc = (fee ? p.document : null) as Record<string, unknown> | null;
  const number = str(p.invoice_number ?? p.credit_note_number ?? p.number);
  const date = str(p.issue_date ?? (fee ? str(p.issued_at).slice(0, 10) : ""));
  const customer = (p.customer ?? doc?.customer) as Record<string, unknown> | undefined;
  const client = supplier ? "OPPE SAS" : customer && typeof customer === "object" ? str(customer.name)
    : str(p.client_name ?? (p.client as Record<string, unknown> | undefined)?.name);
  const credit = entry.document_kind === "binder_credit_note" || entry.document_kind === "oppe_credit_note" || (fee && p.kind === "credit_note");
  const amount = (key: "ht" | "vat" | "ttc") => Math.abs(num(supplier
    ? { ht: p.amount_ht_cents, vat: p.vat_cents, ttc: p.amount_ttc_cents }[key]
    : { ht: p.total_ht_cents, vat: p.total_vat_cents, ttc: p.total_ttc_cents }[key]));
  const type = supplier ? "facture à OPPE" : fee ? (credit ? "avoir de frais" : "facture de frais") : credit ? "avoir" : "facture";
  return { number, date, client, credit, type, ht: amount("ht"), vat: amount("vat"), ttc: amount("ttc") };
}

/** Une entrée du journal qui est une pièce : émise, ou facture d'atelier remise à OPPE. */
export const isPiece = (e: JournalRow) => e.event === "issued" || (e.event === "submitted" && e.document_kind === "supplier_invoice");

export async function buildIssuerArchive(input: ArchiveInput): Promise<BuiltArchive> {
  const pieces = input.entries.filter(isPiece);
  const money = input.entries.filter((e) => e.event === "payment" || e.event === "refund");

  const facturesCsv = toCsv(
    ["date", "numero", "type", "client", "total_ht", "total_tva", "total_ttc", "devise", "rang_journal", "empreinte_journal"],
    pieces.map((e) => {
      const piece = pieceOf(e);
      const sign = piece.credit ? -1 : 1;
      return [piece.date, piece.number, piece.type, piece.client, euros(sign * piece.ht), euros(sign * piece.vat), euros(sign * piece.ttc),
        str(e.payload.currency ?? "EUR"), e.seq, e.hash];
    }),
  );
  const encaissementsCsv = toCsv(
    ["date", "operation", "mode", "reference", "montant", "devise", "facture", "rang_journal", "empreinte_journal"],
    money.map((e) => {
      const p = e.payload;
      const refund = e.event === "refund" || p.kind === "refund";
      const amount = num(p.amount_cents ?? p.refund_cents);
      return [e.occurred_at.slice(0, 10), refund ? "remboursement" : str(p.kind ?? "reglement"),
        str(p.payment_method ?? p.method ?? (e.document_kind === "supplier_payment" ? "virement" : "")),
        str(p.payment_reference ?? p.reference ?? p.payment_intent_id ?? p.stripe_refund_id),
        euros(refund ? -amount : amount), str(p.currency), str(p.invoice_number ?? p.invoice_id), e.seq, e.hash];
    }),
  );
  const chain = await verifyJournalChain(
    input.entries.map((e) => ({ seq: e.seq, canonical: e.canonical, prevHash: e.prev_hash, hash: e.hash })),
    input.anchor ?? { seq: 0, hash: GENESIS_HASH },
  );
  const readme = [
    `Archive de l'émetteur ${input.issuer.label} (${input.issuer.key})`,
    `Période : ${input.period.label} (du ${input.period.start} inclus au ${input.period.end} exclu, heure de Paris).`,
    `Générée le ${input.generatedAt.toISOString()} par Ma Reliure, version ${input.softwareVersion}.`,
    "",
    "Contenu :",
    "- factures.csv : factures et avoirs de la période (avoirs en négatif).",
    "- encaissements.csv : règlements, paiements en ligne et remboursements de la période.",
    "- pieces.json : le contenu exact de chaque pièce, tel qu'enregistré au journal à son émission.",
    "- journal.jsonl : les entrées du journal de la période, une par ligne, dans l'ordre.",
    "- clotures.json : les clôtures (jour, mois, année) portant sur la période.",
    "- pdf/ : les PDF rangés à l'émission, tels qu'envoyés au client.",
    "- empreintes.sha256 : l'empreinte SHA-256 de chaque fichier ci-dessus.",
    "",
    "Vérifier le journal : pour chaque entrée, SHA-256 (hexadécimal) des octets UTF-8 de",
    "« empreinte précédente + saut de ligne + forme canonique » doit donner son empreinte ; l'empreinte",
    "précédente de la première entrée est celle de l'entrée qui la précède au journal :",
    input.anchor ? `rang ${input.anchor.seq}, empreinte ${input.anchor.hash}.` : `aucune (64 zéros : la période ouvre le journal).`,
    `Contrôle à la génération : ${chain.ok ? "chaîne intacte" : `ANOMALIES ${JSON.stringify(chain.problems)}`}.`,
    "L'empreinte du fichier empreintes.sha256 est inscrite au journal de l'émetteur (événement « export »).",
    ...(input.missingPdfs.length
      ? ["", "PDF non joints :", ...input.missingPdfs.map((m) => `- ${m.number} : ${m.reason}`)]
      : []),
    "",
  ].join("\r\n");

  const files: ZipFile[] = [
    { name: "LISEZMOI.txt", bytes: text(readme) },
    { name: "factures.csv", bytes: text(facturesCsv) },
    { name: "encaissements.csv", bytes: text(encaissementsCsv) },
    { name: "pieces.json", bytes: text(JSON.stringify(pieces.map((e) => ({ document_kind: e.document_kind, document_id: e.document_id,
      seq: e.seq, hash: e.hash, contenu: e.payload })), null, 2)) },
    { name: "journal.jsonl", bytes: text(input.entries.map((e) => JSON.stringify(e)).join("\n") + (input.entries.length ? "\n" : "")) },
    { name: "clotures.json", bytes: text(JSON.stringify(input.closures.map((c) => ({ seq: c.seq, hash: c.hash, ...c.payload })), null, 2)) },
    ...input.pdfs.map((pdf) => ({ name: `pdf/${pdf.name}`, bytes: pdf.bytes })),
  ];
  const manifest = (await Promise.all(files.map(async (f) => `${await sha256Hex(f.bytes)}  ${f.name}`))).join("\n") + "\n";
  const manifestBytes = text(manifest);
  files.push({ name: "empreintes.sha256", bytes: manifestBytes });
  return {
    zip: zipStore(files, input.generatedAt),
    manifestSha256: await sha256HexOfText(manifest),
    fileCount: files.length,
    chainOk: chain.ok,
  };
}

/** Nom de fichier sûr pour un numéro de pièce. */
export const pdfFileName = (number: string) => `${number.replace(/[^A-Za-z0-9._-]/g, "_")}.pdf`;
