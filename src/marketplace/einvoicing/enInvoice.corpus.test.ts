import { describe, expect, it } from "vitest";
import type { CreditNoteDocumentView, DocumentView } from "@/marketplace/quotes/quoteViews";
import { buildEnInvoice, type EnInvoice } from "./enInvoice";

/**
 * Corpus de pièces de reliure : chaque pièce traduite doit se recouper à l'euro près avec son instantané
 * figé. Une traduction qui recalculerait un montant légal, ou qui en perdrait un, échoue ici.
 */
const cents = (value: string) => Math.round(Number(value) * 100);

function item(label: string, totalHtCents: number, vatRateBps: number, extra: Record<string, unknown> = {}) {
  return { position: 0, lineKey: label, blockKey: "b1", serviceId: null, label, description: null, unit: null, quantity: 1, unitPriceCents: totalHtCents, catalogPriceCents: null, vatRateBps, totalHtCents, photos: [], ...extra };
}

const COMPLIANCE = {
  serviceDate: "2026-10-30", dueDate: "2026-11-30", operationNature: "services", clientType: "business",
  clientLegalName: "Bibliothèque Exemple SAS", billingAddressLine1: "1 rue Neuve", billingPostalCode: "75006", billingCity: "Paris", billingCountry: "FR",
  clientSiren: "552 100 554", clientVatNumber: null, purchaseOrderNumber: null, publicServiceCode: null, publicCommitmentNumber: null,
  deliveryAddressLine1: null, deliveryPostalCode: null, deliveryCity: null, deliveryCountry: null,
  earlyPaymentDiscountTerms: "Pas d'escompte.", latePenaltyTerms: "Trois fois le taux légal.", legalMentions: [],
};

function piece(items: ReturnType<typeof item>[], totals: { discount?: number; vat: { vatRateBps: number; baseHtCents: number; vatCents: number }[] }, overrides: Record<string, unknown> = {}, compliance: Record<string, unknown> = {}): DocumentView {
  const subtotal = items.reduce((sum, line) => sum + line.totalHtCents, 0);
  const discount = totals.discount ?? 0;
  const ht = subtotal - discount;
  const vat = totals.vat.reduce((sum, group) => sum + group.vatCents, 0);
  return {
    kind: "invoice", id: "i1", number: "F-2026-0042", status: "issued", issueDate: "2026-11-01", validUntil: null,
    client: { id: null, name: "Client", email: "client@example.com", phone: null, addressLine1: "1 rue Neuve", postalCode: "75006", city: "Paris", country: "FR" },
    book: { title: null, author: null, heightMm: null, widthMm: null, spineMm: null, notes: null },
    blocks: [{ key: "b1", label: "Lot", bookCount: 1, heightMm: null, widthMm: null, spineMm: null }],
    items, currency: "EUR",
    issuer: {
      workshopName: "Atelier d'exemple", binderName: null, legalName: "Exemple SARL", legalForm: "SARL", shareCapital: "5 000 €", siren: "732 829 320",
      addressLine1: "9 rue Pothier", addressLine2: null, postalCode: "78000", city: "Versailles", country: "FR", siret: "73282932000074", vatNumber: "FR44 732829320",
      vatOnDebits: false, legalNotes: null, email: null, phone: null, website: null, logoStoragePath: null, logoUrl: null, documentAccentColor: null, documentFooter: null,
      iban: "FR76 3000 6000 0112 3456 7890 189",
    },
    vatRegime: "VAT_LIABLE", vatMention: null, paymentTerms: "30 jours", notes: null,
    subtotalCents: subtotal, discountType: discount ? "AMOUNT" : "NONE", discountValue: discount, discountCents: discount,
    totalHtCents: ht, totalVatCents: vat, totalTtcCents: ht + vat, vatBreakdown: totals.vat,
    depositType: "NONE", depositValue: 0, depositCents: 0, balanceCents: ht + vat,
    linkedQuoteId: null, linkedQuoteNumber: null, linkedInvoiceId: null, linkedInvoiceNumber: null, createdAt: "2026-11-01T10:00:00Z",
    payment: null, creditNote: null,
    invoiceCompliance: { ...COMPLIANCE, ...compliance },
    ...overrides,
  } as unknown as DocumentView;
}

/** Les invariants EN 16931 qui ne dépendent d'aucune plateforme. */
function expectCoherent(document: DocumentView | CreditNoteDocumentView, value: EnInvoice) {
  const lines = value.lines.reduce((sum, line) => sum + cents(line.net_amount), 0);
  const allowances = (value.document_level_allowances ?? []).reduce((sum, allowance) => sum + cents(allowance.amount), 0);
  expect(cents(value.totals.sum_invoice_lines_amount)).toBe(lines);
  expect(lines - allowances).toBe(cents(value.totals.total_without_vat));
  expect(value.vat_break_down.reduce((sum, group) => sum + cents(group.vat_category_taxable_amount), 0)).toBe(cents(value.totals.total_without_vat));
  expect(value.vat_break_down.reduce((sum, group) => sum + cents(group.vat_category_tax_amount), 0)).toBe(cents(value.totals.total_vat_amount.value));
  expect(cents(value.totals.total_without_vat) + cents(value.totals.total_vat_amount.value)).toBe(cents(value.totals.total_with_vat));
  // Les montants traduits sont ceux de l'instantané figé, jamais recalculés.
  expect(cents(value.totals.total_without_vat)).toBe(document.totalHtCents);
  expect(cents(value.totals.total_vat_amount.value)).toBe(document.totalVatCents);
  expect(cents(value.totals.total_with_vat)).toBe(document.totalTtcCents);
  expect(cents(value.totals.amount_due_for_payment)).toBe(document.totalTtcCents);
}

function translate(document: DocumentView | CreditNoteDocumentView): EnInvoice {
  const result = buildEnInvoice(document);
  if (!result.ok) throw new Error(result.blockers.join(","));
  return result.invoice;
}

describe("corpus de pièces de reliure", () => {
  it("reliure et étui à deux taux, avec remise : les bases par taux suivent l'instantané", () => {
    const document = piece(
      [item("Reliure plein cuir", 18000, 2000), item("Étui", 6000, 550)],
      { discount: 2400, vat: [{ vatRateBps: 2000, baseHtCents: 16200, vatCents: 3240 }, { vatRateBps: 550, baseHtCents: 5400, vatCents: 297 }] },
    );
    expectCoherent(document, translate(document));
  });

  it("trois taux, dont un transport", () => {
    const document = piece(
      [item("Restauration du dos", 12000, 2000), item("Boîte de conservation", 4500, 550), item("Transport", 1500, 2000)],
      { vat: [{ vatRateBps: 2000, baseHtCents: 13500, vatCents: 2700 }, { vatRateBps: 550, baseHtCents: 4500, vatCents: 248 }] },
    );
    expectCoherent(document, translate(document));
  });

  it("un lot de trois livres : la quantité suit le nombre de livres", () => {
    const document = piece(
      [item("Reliure demi-toile", 15000, 2000, { quantity: 1, unitPriceCents: 5000 })],
      { vat: [{ vatRateBps: 2000, baseHtCents: 15000, vatCents: 3000 }] },
      { blocks: [{ key: "b1", label: "Lot", bookCount: 3, heightMm: null, widthMm: null, spineMm: null }] },
    );
    const value = translate(document);
    expectCoherent(document, value);
    expect(value.lines[0].invoiced_quantity).toBe("3");
  });

  it("un atelier en franchise de TVA : aucun montant de TVA, motif porté par la ventilation", () => {
    const document = piece(
      [item("Réparation de charnière", 9000, 0)],
      { vat: [{ vatRateBps: 0, baseHtCents: 9000, vatCents: 0 }] },
      { vatRegime: "FRANCHISE", issuer: { ...piece([], { vat: [] }).issuer, vatNumber: null } },
    );
    const value = translate(document);
    expectCoherent(document, value);
    expect(value.vat_break_down[0].vat_exemption_reason_code).toBeDefined();
    expect(value.seller.vat_identifier).toBeUndefined();
  });

  it("une vente à un particulier : e-mail et marque de vente à un particulier, sans clause réservée aux professionnels", () => {
    const document = piece(
      [item("Reliure de mémoire", 24000, 2000)],
      { vat: [{ vatRateBps: 2000, baseHtCents: 24000, vatCents: 4800 }] },
      {},
      { clientType: "individual", clientSiren: null },
    );
    const value = translate(document);
    expectCoherent(document, value);
    expect(JSON.stringify(value.notes)).not.toContain("40 €");
  });

  it("un avoir partiel : mêmes invariants, rattaché à la facture d'origine", () => {
    const base = piece([item("Réparation", 6000, 2000)], { vat: [{ vatRateBps: 2000, baseHtCents: 6000, vatCents: 1200 }] });
    const credit = { ...base, kind: "credit_note", number: "A-2026-0007", originalInvoice: { number: "F-2026-0042", issueDate: "2026-11-01" }, reason: "Remise accordée après livraison" } as unknown as CreditNoteDocumentView;
    const value = translate(credit);
    expectCoherent(credit, value);
    expect(value.type_code).toBe(381);
  });
});
