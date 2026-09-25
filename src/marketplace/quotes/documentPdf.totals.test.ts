// Le bandeau du total (« Total TTC » / « Total à payer ») est un aplat plein :
// tout texte qu'il chevauche disparaît du PDF. On relève les appels de dessin
// de pdf-lib et on vérifie qu'aucune autre ligne des totaux n'est dessous.
import { PDFPage } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderDocumentPdf } from "./documentPdf";
import type { DocumentView } from "./quoteViews";

type Op =
  | { kind: "text"; page: PDFPage; text: string; y: number; size: number }
  | { kind: "rect"; page: PDFPage; y: number; height: number };

function document(overrides: Partial<DocumentView> = {}): DocumentView {
  return {
    kind: "quote", id: "q1", number: "D-2026-0001", status: "draft", issueDate: "2026-09-25", validUntil: "2026-10-25",
    client: { id: null, name: "Claire Dubreuil", email: null, phone: null, addressLine1: null, postalCode: null, city: null, country: null },
    book: { title: "Carnet de voyage", author: null, heightMm: null, widthMm: null, spineMm: null, notes: null },
    blocks: [], items: [], currency: "EUR",
    issuer: {
      workshopName: "Atelier d'exemple", binderName: null, legalName: null, legalForm: null, shareCapital: null, siren: null,
      addressLine1: null, addressLine2: null, postalCode: null, city: null, country: "FR", siret: null, vatNumber: null,
      vatOnDebits: false, legalNotes: null, email: null, phone: null, website: null, logoStoragePath: null, logoUrl: null,
      documentAccentColor: "#7a2230", documentFooter: null, iban: null,
    },
    vatRegime: "VAT_LIABLE", vatMention: null, paymentTerms: null, notes: null,
    subtotalCents: 35000, discountType: "NONE", discountValue: 0, discountCents: 0,
    totalHtCents: 35000, totalVatCents: 7000, totalTtcCents: 42000,
    vatBreakdown: [{ vatRateBps: 2000, baseHtCents: 35000, vatCents: 7000 }],
    depositType: "NONE", depositValue: 0, depositCents: 0, balanceCents: 42000,
    linkedQuoteId: null, linkedQuoteNumber: null, linkedInvoiceId: null, linkedInvoiceNumber: null,
    createdAt: "2026-09-25T10:00:00Z", payment: null, invoiceCompliance: null, creditNote: null,
    ...overrides,
  };
}

async function drawingOps(doc: DocumentView): Promise<Op[]> {
  const ops: Op[] = [];
  const drawText = PDFPage.prototype.drawText;
  const drawRectangle = PDFPage.prototype.drawRectangle;
  vi.spyOn(PDFPage.prototype, "drawText").mockImplementation(function (this: PDFPage, text, options) {
    ops.push({ kind: "text", page: this, text, y: options?.y ?? 0, size: options?.size ?? 12 });
    return drawText.call(this, text, options);
  });
  vi.spyOn(PDFPage.prototype, "drawRectangle").mockImplementation(function (this: PDFPage, options) {
    ops.push({ kind: "rect", page: this, y: options?.y ?? 0, height: options?.height ?? 0 });
    return drawRectangle.call(this, options);
  });
  await renderDocumentPdf(doc);
  return ops;
}

/** Textes recouverts par le bandeau du total, hors ceux qu'il porte (même ligne de base). */
async function hiddenUnderTotalBand(doc: DocumentView, label: string): Promise<string[]> {
  const ops = await drawingOps(doc);
  const at = ops.findIndex((op) => op.kind === "text" && op.text === label);
  expect(at, `« ${label} » doit être imprimé`).toBeGreaterThan(0);
  const band = ops[at - 1];
  const labelOp = ops[at];
  if (band.kind !== "rect" || labelOp.kind !== "text") throw new Error("le total n'est pas posé sur un bandeau");
  return ops
    .filter((op): op is Extract<Op, { kind: "text" }> => op.kind === "text" && op.page === band.page && op.y !== labelOp.y)
    // Encombrement vertical d'une ligne : jambages sous la ligne de base, capitales au-dessus.
    .filter((op) => op.y + op.size * 0.72 > band.y && op.y - op.size * 0.22 < band.y + band.height)
    .map((op) => op.text);
}

afterEach(() => vi.restoreAllMocks());

describe("totaux du PDF : rien sous le bandeau du total", () => {
  it("la ligne TVA reste visible au-dessus du Total TTC", async () => {
    expect(await hiddenUnderTotalBand(document(), "Total TTC")).toEqual([]);
  });

  it("avec plusieurs taux et une remise", async () => {
    const doc = document({
      discountType: "PERCENT", discountValue: 1000, discountCents: 3500, subtotalCents: 38500,
      vatBreakdown: [{ vatRateBps: 2000, baseHtCents: 25000, vatCents: 5000 }, { vatRateBps: 550, baseHtCents: 10000, vatCents: 550 }],
    });
    expect(await hiddenUnderTotalBand(doc, "Total TTC")).toEqual([]);
  });

  it("avec un acompte, dont les lignes suivent le bandeau", async () => {
    const doc = document({ depositType: "PERCENT", depositValue: 3000, depositCents: 12600, balanceCents: 29400 });
    expect(await hiddenUnderTotalBand(doc, "Total TTC")).toEqual([]);
  });

  it("en franchise de TVA : « Total à payer » ne recouvre pas le Total HT", async () => {
    const doc = document({ vatRegime: "FRANCHISE", vatBreakdown: [], totalVatCents: 0, totalTtcCents: 35000, balanceCents: 35000 });
    expect(await hiddenUnderTotalBand(doc, "Total à payer")).toEqual([]);
  });
});
