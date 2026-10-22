import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { journalHash } from "@/marketplace/ledger/journalChain";
import { unzipStore } from "@/marketplace/ledger/zip";

vi.mock("./binderQuotes.server", () => ({
  getInvoice: vi.fn(async (_sb: unknown, _b: string, id: string) => ({ kind: "invoice", id, status: "issued" })),
  getCreditNote: vi.fn(async (_sb: unknown, _b: string, id: string) => ({ kind: "credit_note", id, status: "issued" })),
}));
vi.mock("./issuedDocumentPdf.server", () => {
  class IssuedPdfIntegrityError extends Error {}
  return {
    IssuedPdfIntegrityError,
    storeIssuedPdf: vi.fn(async (_sb: unknown, _b: string, doc: { id: string }) => {
      if (doc.id === "c1") throw new IssuedPdfIntegrityError("altéré");
      return new TextEncoder().encode(`%PDF ${doc.id}`);
    }),
    storeOppeIssuedPdf: vi.fn(),
  };
});
const { exportIssuerArchive, periodBounds } = await import("./issuerLedger.server");

const BINDER = "b0000000-0000-4000-8000-000000000001";
const ISSUER = `binder:${BINDER}`;

async function rows() {
  const raw = [
    { event: "issued", document_kind: "binder_invoice", document_id: "i1", occurred_at: "2026-02-28T23:30:00.000000Z",
      payload: { invoice_number: "F-2026-0001", issue_date: "2026-03-01", total_ht_cents: 100, total_vat_cents: 20, total_ttc_cents: 120 } },
    { event: "issued", document_kind: "binder_credit_note", document_id: "c1", occurred_at: "2026-03-15T10:00:00.000000Z",
      payload: { credit_note_number: "A-2026-0001", issue_date: "2026-03-15", total_ht_cents: 100, total_vat_cents: 20, total_ttc_cents: 120 } },
    { event: "payment", document_kind: "settlement", document_id: "s1", occurred_at: "2026-03-31T22:30:00.000000Z",
      payload: { kind: "receipt", payment_method: "virement", amount_cents: 120 } },
  ];
  const out = [];
  let prev = "1".repeat(64);
  for (const [i, r] of raw.entries()) {
    const seq = 8 + i;
    const canonical = JSON.stringify({ seq, ...r });
    const hash = await journalHash(prev, canonical);
    out.push({ issuer_key: ISSUER, seq, event_key: `k${seq}`, actor: "system", canonical, prev_hash: prev, hash, ...r });
    prev = hash;
  }
  return out;
}

function fakeSb(journal: Awaited<ReturnType<typeof rows>>) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const sb = {
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: name === "marketplace_journal_close_due" ? 0 : "h", error: null };
    }),
    from: (table: string) => {
      const filters: ((r: Record<string, unknown>) => boolean)[] = [];
      const q: Record<string, unknown> = {};
      Object.assign(q, {
        select: () => q,
        eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), q),
        gte: (c: string, v: string) => (filters.push((r) => (c.startsWith("payload") ? true : String(r[c]) >= v)), q),
        lt: (c: string, v: string) => (filters.push((r) => String(r[c]) < v), q),
        lte: () => q,
        order: () => q,
        maybeSingle: async () => ({ data: table === "marketplace_issuer_journal" ? { seq: 7, hash: "1".repeat(64) }
          : { legal_name: "Atelier QA", siren: "732829320" }, error: null }),
        then: (resolve: (v: unknown) => void) => resolve({ data: table === "marketplace_issuer_journal"
          ? journal.filter((r) => filters.every((f) => f(r as never))) : [], error: null }),
      });
      return q;
    },
  };
  return { sb: sb as never, calls };
}

beforeEach(() => vi.clearAllMocks());

describe("export d'archives d'un émetteur", () => {
  it("prend la période en jour civil à Paris, joint les PDF, signale l'altération et inscrit l'export", async () => {
    const { sb, calls } = fakeSb(await rows());
    const result = await exportIssuerArchive(sb, ISSUER, { year: 2026, month: 3 }, "actor-1");
    const files = unzipStore(Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0)));
    // 28/02 à 23 h 30 UTC = 1er mars à Paris ; 31/03 à 22 h 30 UTC = 1er avril à Paris (hors période).
    expect(result.entries).toBe(2);
    expect(files.map((f) => f.name)).toContain("pdf/F-2026-0001.pdf");
    expect(files.map((f) => f.name)).not.toContain("pdf/A-2026-0001.pdf");
    expect(new TextDecoder().decode(files[0].bytes)).toContain("A-2026-0001 : PDF rangé altéré ou absent");
    expect(new TextDecoder().decode(files[0].bytes)).toContain("chaîne intacte");
    const manifest = files.find((f) => f.name === "empreintes.sha256")!;
    expect(result.manifestSha256).toBe(createHash("sha256").update(manifest.bytes).digest("hex"));
    const exported = calls.find((c) => c.name === "marketplace_journal_record_event")!;
    expect(exported.args).toMatchObject({ p_issuer: ISSUER, p_event: "export", p_actor: "actor-1",
      p_payload: expect.objectContaining({ manifest_sha256: result.manifestSha256, period_start: "2026-03-01", missing_pdfs: 1, chain_ok: true }) });
    expect(calls[0].name).toBe("marketplace_journal_close_due");
    expect(result.filename).toBe("archives-atelier-2026-03.zip");
  });

  it("borne l'année et le mois", () => {
    expect(periodBounds({ year: 2026, month: 12 })).toMatchObject({ start: "2026-12-01", end: "2027-01-01", label: "décembre 2026" });
    expect(periodBounds({ year: 2026, month: null })).toMatchObject({ start: "2026-01-01", end: "2027-01-01", label: "année 2026" });
  });
});
