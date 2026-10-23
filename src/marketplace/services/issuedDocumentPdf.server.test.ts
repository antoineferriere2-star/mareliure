import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ISSUED_DOCUMENTS_BUCKET,
  ISSUED_PDF_UNAVAILABLE_MESSAGE,
  IssuedPdfIntegrityError,
  issuedPdfBase64,
  issuedPdfBase64ForCustomer,
  sha256Hex,
  storeIssuedPdf,
  storeIssuedPdfQuietly,
} from "./issuedDocumentPdf.server";
import { renderDocumentPdf } from "@/marketplace/quotes/documentPdf";

let renders = 0;
vi.mock("@/marketplace/quotes/documentPdf", () => ({
  // Chaque rendu diffère (horodatage du PDF) : c'est précisément pourquoi on ne régénère jamais.
  renderDocumentPdf: vi.fn(async () => ({ base64: btoa(`%PDF-rendu-${++renders}`), pageCount: 1, printed: [] })),
}));

const BINDER = "binder-a";
type Row = { id: string; binder_id: string; pdf_path: string | null; pdf_sha256: string | null };

function world() {
  const tables: Record<string, Row[]> = {
    marketplace_binder_invoices: [{ id: "inv", binder_id: BINDER, pdf_path: null, pdf_sha256: null }],
    marketplace_binder_credit_notes: [{ id: "cn", binder_id: BINDER, pdf_path: null, pdf_sha256: null }],
  };
  const files = new Map<string, Uint8Array>();
  const uploads: string[] = [];
  const sb = {
    from(table: string) {
      const filters: Array<(row: Row) => boolean> = [];
      let patch: Partial<Row> | null = null;
      const query = {
        select: () => query,
        update: (value: Partial<Row>) => ((patch = value), query),
        eq: (column: keyof Row, value: unknown) => (filters.push((row) => row[column] === value), query),
        is: (column: keyof Row, value: unknown) => (filters.push((row) => row[column] === value), query),
        maybeSingle: async () => ({ data: tables[table].find((row) => filters.every((f) => f(row))) ?? null, error: null }),
        then: (resolve: (value: unknown) => void) => {
          const rows = tables[table].filter((row) => filters.every((f) => f(row)));
          if (patch) rows.forEach((row) => Object.assign(row, patch));
          resolve({ data: rows.map((row) => ({ id: row.id })), error: null });
        },
      };
      return query;
    },
    storage: {
      from(bucket: string) {
        expect(bucket).toBe(ISSUED_DOCUMENTS_BUCKET);
        return {
          download: async (path: string) =>
            files.has(path)
              ? { data: new Blob([files.get(path)! as Uint8Array<ArrayBuffer>]), error: null }
              : { data: null, error: { message: "not found" } },
          upload: async (path: string, bytes: Uint8Array) => {
            uploads.push(path);
            if (files.has(path)) return { error: { message: "exists" } };
            files.set(path, bytes);
            return { error: null };
          },
        };
      },
    },
  };
  return { sb: sb as never, tables, files, uploads };
}

const invoice = { kind: "invoice", id: "inv", status: "issued" } as never;
const creditNote = { kind: "credit_note", id: "cn", status: "issued" } as never;
const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

beforeEach(() => {
  renders = 0;
  vi.mocked(renderDocumentPdf).mockClear();
});

describe("PDF des pièces émises", () => {
  it("est produit une seule fois, rangé avec son empreinte, puis resservi tel quel", async () => {
    const w = world();
    const first = await storeIssuedPdf(w.sb, BINDER, invoice);
    const row = w.tables.marketplace_binder_invoices[0];
    expect(row.pdf_path).toBe(`${BINDER}/invoice/inv.pdf`);
    expect(row.pdf_sha256).toBe(await sha256Hex(first));
    const again = await issuedPdfBase64(w.sb, BINDER, invoice);
    expect(atob(again)).toBe(text(first));
    expect(renderDocumentPdf).toHaveBeenCalledTimes(1);
    expect(w.uploads).toEqual([`${BINDER}/invoice/inv.pdf`]);
  });

  it("vaut aussi pour les avoirs", async () => {
    const w = world();
    await storeIssuedPdf(w.sb, BINDER, creditNote);
    expect(w.tables.marketplace_binder_credit_notes[0].pdf_path).toBe(`${BINDER}/credit_note/cn.pdf`);
  });

  it("refuse de servir un fichier altéré, sans le régénérer, et le journalise pour l'admin", async () => {
    const w = world();
    const original = await storeIssuedPdf(w.sb, BINDER, invoice);
    w.files.set(`${BINDER}/invoice/inv.pdf`, new TextEncoder().encode("%PDF-modifié"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(issuedPdfBase64(w.sb, BINDER, invoice)).rejects.toBeInstanceOf(IssuedPdfIntegrityError);
    expect(renderDocumentPdf).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(String(log.mock.calls[0][0]));
    expect(entry).toMatchObject({
      event: "issued_pdf_integrity_failure", severity: "critical", reason: "hash_mismatch", kind: "invoice",
      binderId: BINDER, documentId: "inv", path: `${BINDER}/invoice/inv.pdf`, expectedSha256: await sha256Hex(original),
    });
    expect(entry.actualSha256).toMatch(/^[0-9a-f]{64}$/);
    // Le client de l'atelier lit un message, pas une erreur technique.
    await expect(issuedPdfBase64ForCustomer(w.sb, BINDER, invoice)).rejects.toThrow(ISSUED_PDF_UNAVAILABLE_MESSAGE);
    w.files.delete(`${BINDER}/invoice/inv.pdf`);
    await expect(issuedPdfBase64(w.sb, BINDER, invoice)).rejects.toBeInstanceOf(IssuedPdfIntegrityError);
    const failures = log.mock.calls.map((call) => JSON.parse(String(call[0]))).filter((e) => e.event === "issued_pdf_integrity_failure");
    expect(failures.at(-1)).toMatchObject({ reason: "stored_file_missing", actualSha256: null });
    log.mockRestore();
  });

  it("retient le fichier déjà envoyé si l'enregistrement de l'empreinte avait échoué", async () => {
    const w = world();
    w.files.set(`${BINDER}/invoice/inv.pdf`, new TextEncoder().encode("%PDF-premier"));
    const bytes = await storeIssuedPdf(w.sb, BINDER, invoice);
    expect(text(bytes)).toBe("%PDF-premier");
    expect(renderDocumentPdf).not.toHaveBeenCalled();
    expect(w.tables.marketplace_binder_invoices[0].pdf_sha256).toBe(await sha256Hex(bytes));
  });

  it("ne range jamais un brouillon", async () => {
    await expect(storeIssuedPdf(world().sb, BINDER, { kind: "invoice", id: "inv", status: "draft" } as never))
      .rejects.toThrow("issued_pdf_draft");
  });

  it("un échec de rangement à l'émission n'annule pas l'émission", async () => {
    const w = world();
    w.tables.marketplace_binder_invoices = [];
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(storeIssuedPdfQuietly(w.sb, BINDER, invoice)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
