import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildIssuerArchive, toCsv, type JournalRow } from "./archive";
import { GENESIS_HASH, journalHash } from "./journalChain";
import { crc32, unzipStore } from "./zip";

const sha = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");

async function chain(rows: Omit<JournalRow, "prev_hash" | "hash" | "canonical" | "seq">[], start = { seq: 0, hash: GENESIS_HASH }) {
  const out: JournalRow[] = [];
  let prev = start.hash;
  for (const [i, row] of rows.entries()) {
    const seq = start.seq + i + 1;
    const canonical = JSON.stringify({ seq, event: row.event, payload: row.payload });
    const hash = await journalHash(prev, canonical);
    out.push({ ...row, seq, canonical, prev_hash: prev, hash });
    prev = hash;
  }
  return out;
}

const base = { issuer_key: "binder:x", actor: "system", occurred_at: "2026-03-10T09:00:00.000000Z" };

describe("archive d'un émetteur", () => {
  it("contient tous les fichiers attendus, et chaque empreinte concorde", async () => {
    const entries = await chain([
      { ...base, event: "issued", event_key: "a", document_kind: "binder_invoice", document_id: "i1",
        payload: { invoice_number: "F-2026-0001", issue_date: "2026-03-10", client_name: "Mme Durand", currency: "EUR",
          total_ht_cents: 10_000, total_vat_cents: 2_000, total_ttc_cents: 12_000 } },
      { ...base, event: "payment", event_key: "b", document_kind: "settlement", document_id: "s1",
        payload: { kind: "receipt", payment_method: "cheque", payment_reference: "1234567", amount_cents: 12_000, currency: "EUR", invoice_number: "F-2026-0001" } },
      { ...base, event: "issued", event_key: "c", document_kind: "binder_credit_note", document_id: "c1",
        payload: { credit_note_number: "A-2026-0001", issue_date: "2026-03-10", currency: "EUR", total_ht_cents: 10_000, total_vat_cents: 2_000, total_ttc_cents: 12_000 } },
    ], { seq: 4, hash: "e".repeat(64) });
    const pdf = new TextEncoder().encode("%PDF-1.7 QA");
    const built = await buildIssuerArchive({
      issuer: { key: "binder:x", label: "Atelier QA" }, period: { start: "2026-03-01", end: "2026-04-01", label: "mars 2026" },
      entries, anchor: { seq: 4, hash: "e".repeat(64) }, closures: [], pdfs: [{ name: "F-2026-0001.pdf", bytes: pdf }],
      missingPdfs: [{ number: "A-2026-0001", reason: "PDF altéré" }], softwareVersion: "abc123", generatedAt: new Date("2026-04-02T08:00:00Z"),
    });
    expect(built.chainOk).toBe(true);
    const files = unzipStore(built.zip);
    expect(files.map((f) => f.name)).toEqual(["LISEZMOI.txt", "factures.csv", "encaissements.csv", "pieces.json", "journal.jsonl",
      "clotures.json", "pdf/F-2026-0001.pdf", "empreintes.sha256"]);
    const manifest = new TextDecoder().decode(files.at(-1)!.bytes);
    for (const file of files.slice(0, -1)) expect(manifest).toContain(`${sha(file.bytes)}  ${file.name}`);
    expect(built.manifestSha256).toBe(sha(files.at(-1)!.bytes));
    expect(files.find((f) => f.name === "pdf/F-2026-0001.pdf")!.bytes).toEqual(pdf);
    const factures = new TextDecoder().decode(files[1].bytes);
    expect(factures).toContain("2026-03-10;F-2026-0001;facture;Mme Durand;100,00;20,00;120,00;EUR;5;");
    expect(factures).toContain("A-2026-0001;avoir;;-100,00;-20,00;-120,00");
    expect(new TextDecoder().decode(files[2].bytes)).toContain(";receipt;cheque;1234567;120,00;EUR;F-2026-0001;6;");
    const readme = new TextDecoder().decode(files[0].bytes);
    expect(readme).toContain(`rang 4, empreinte ${"e".repeat(64)}`);
    expect(readme).toContain("chaîne intacte");
    expect(readme).toContain("A-2026-0001 : PDF altéré");
    expect(new TextDecoder().decode(files[4].bytes).trim().split("\n")).toHaveLength(3);
  });

  it("signale dans l'archive une chaîne rompue", async () => {
    const entries = await chain([{ ...base, event: "issued", event_key: "a", document_kind: "binder_invoice", document_id: "i1", payload: {} }]);
    entries[0] = { ...entries[0], canonical: entries[0].canonical + " " };
    const built = await buildIssuerArchive({ issuer: { key: "binder:x", label: "QA" }, period: { start: "2026-03-01", end: "2026-04-01", label: "mars" },
      entries, anchor: null, closures: [], pdfs: [], missingPdfs: [], softwareVersion: "x", generatedAt: new Date("2026-04-02T08:00:00Z") });
    expect(built.chainOk).toBe(false);
    expect(new TextDecoder().decode(unzipStore(built.zip)[0].bytes)).toContain("ANOMALIES");
  });

  it("produit un CSV lisible par un tableur français et un CRC conforme", () => {
    expect(toCsv(["a", "b"], [["x;y", 'dit "oui"']])).toBe('﻿a;b\r\n"x;y";"dit ""oui"""\r\n');
    expect(crc32(new TextEncoder().encode("123456789")).toString(16)).toBe("cbf43926");
  });
});
