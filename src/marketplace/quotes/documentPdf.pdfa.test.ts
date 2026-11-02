// Contrat PDF/A-3B de nos documents : ce que le Factur-X exige du PDF lisible.
// Il ne remplace pas veraPDF, il empêche seulement de perdre ces éléments sans le voir.
import { PDFDocument, PDFName } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderDocumentPdf } from "./documentPdf";
import { IMAGE_CMYK_MESSAGE, imageUploadProblem, isCmykJpeg, jpegComponents } from "./jpegColor";
import type { DocumentView } from "./quoteViews";

const document = {
  kind: "invoice", id: "i1", number: "F-2026-0001", status: "issued", issueDate: "2026-11-01", validUntil: null,
  client: { id: null, name: "Hélène Lefèvre-Œillet", email: null, phone: null, addressLine1: null, postalCode: null, city: null, country: null },
  book: { title: "Les Misérables", author: null, heightMm: null, widthMm: null, spineMm: null, notes: null },
  blocks: [], items: [], currency: "EUR",
  issuer: {
    workshopName: "Atelier <d'exemple> & fils", binderName: null, legalName: null, legalForm: null, shareCapital: null, siren: null,
    addressLine1: null, addressLine2: null, postalCode: null, city: null, country: "FR", siret: null, vatNumber: null,
    vatOnDebits: false, legalNotes: null, email: null, phone: null, website: null, logoStoragePath: null, logoUrl: null,
    documentAccentColor: "#7a2230", documentFooter: null, iban: null,
  },
  vatRegime: "VAT_LIABLE", vatMention: null, paymentTerms: null, notes: null,
  subtotalCents: 10000, discountType: "NONE", discountValue: 0, discountCents: 0,
  totalHtCents: 10000, totalVatCents: 2000, totalTtcCents: 12000,
  vatBreakdown: [{ vatRateBps: 2000, baseHtCents: 10000, vatCents: 2000 }],
  depositType: "NONE", depositValue: 0, depositCents: 0, balanceCents: 12000,
  linkedQuoteId: null, linkedQuoteNumber: null, linkedInvoiceId: null, linkedInvoiceNumber: null,
  createdAt: "2026-11-01T10:00:00Z", payment: null, invoiceCompliance: null, creditNote: null,
} as unknown as DocumentView;

async function rendered() {
  const { base64, printed } = await renderDocumentPdf(document);
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  return { pdf: await PDFDocument.load(bytes, { updateMetadata: false }), raw: Buffer.from(bytes).toString("latin1"), printed };
}

const jpeg = (components: number) => Uint8Array.from([
  0xff, 0xd8,
  0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46,
  0xff, 0xc0, 0x00, 0x08 + components * 3, 0x08, 0x00, 0x10, 0x00, 0x10, components,
  ...Array.from({ length: components * 3 }, () => 0x11),
  0xff, 0xd9,
]);

afterEach(() => vi.unstubAllGlobals());

describe("images JPEG", () => {
  it("lit le nombre de composantes dans l'en-tête", () => {
    expect(jpegComponents(jpeg(3))).toBe(3);
    expect(jpegComponents(jpeg(4))).toBe(4);
    expect(jpegComponents(Uint8Array.from([0xff, 0xd8, 0x00, 0x00, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull();
    expect(isCmykJpeg(jpeg(4))).toBe(true);
    expect(isCmykJpeg(jpeg(3))).toBe(false);
  });

  it("montre le refus CMJN, garde le message de l'écran pour le reste", () => {
    expect(imageUploadProblem(new Error(IMAGE_CMYK_MESSAGE), "Réessayez.")).toBe(IMAGE_CMYK_MESSAGE);
    expect(imageUploadProblem(new Error("failed"), "Réessayez.")).toBe("Réessayez.");
    expect(imageUploadProblem(null, "Réessayez.")).toBe("Réessayez.");
  });

  it("écarte un logo CMJN, garde un logo RVB", async () => {
    const withLogo = (components: number) => {
      vi.stubGlobal("fetch", async () => new Response(jpeg(components), { headers: { "content-type": "image/jpeg" } }));
      return renderDocumentPdf({ ...document, issuer: { ...document.issuer, logoUrl: "https://exemple.test/logo.jpg" } });
    };
    const raw = async (components: number) => Buffer.from((await withLogo(components)).base64, "base64").toString("latin1");
    expect(await raw(4)).not.toContain("/DCTDecode");
    expect(await raw(3)).toContain("/DCTDecode");
  });
});

describe("documents au format PDF/A-3B", () => {
  it("déclare le profil de couleur sRGB", async () => {
    const { pdf } = await rendered();
    const intents = pdf.catalog.lookup(PDFName.of("OutputIntents"));
    expect(String(intents)).toContain("/GTS_PDFA1");
    expect(String(intents)).toContain("/DestOutputProfile");
  });

  it("annonce PDF/A-3B dans des métadonnées lisibles, cohérentes avec le dictionnaire Info", async () => {
    const { pdf, raw } = await rendered();
    expect(raw).toContain("<pdfaid:part>3</pdfaid:part>");
    expect(raw).toContain("<pdfaid:conformance>B</pdfaid:conformance>");
    expect(pdf.getTitle()).toBe("FACTURE F-2026-0001");
    expect(raw).toContain(">FACTURE F-2026-0001<");
    expect(pdf.getProducer()).toBe("Ma Reliure");
    expect(raw).toContain("<pdf:Producer>Ma Reliure</pdf:Producer>");
  });

  it("échappe le nom de l'atelier dans le XML", async () => {
    const { raw } = await rendered();
    expect(raw).toContain("Atelier &lt;d'exemple&gt; &amp; fils");
  });

  it("identifie le fichier", async () => {
    const { pdf } = await rendered();
    expect(pdf.context.trailerInfo.ID).toBeDefined();
  });

  it("n'utilise que des polices embarquées, sans nom réservé", async () => {
    const { raw } = await rendered();
    expect(raw).not.toMatch(/\/BaseFont\s*\/(Helvetica|Times)/);
    expect(raw).not.toContain("Liberation");
  });

  it("garde le texte accentué", async () => {
    const { printed } = await rendered();
    expect(printed).toContain("Hélène Lefèvre-Œillet");
  });
});
