import { describe, expect, it } from "vitest";
import type { CreditNoteDocumentView, DocumentView } from "@/marketplace/quotes/quoteViews";
import { buildEnInvoice, type EnInvoice } from "./enInvoice";

const item = (overrides: Record<string, unknown> = {}) => ({
  position: 0, lineKey: "l1", blockKey: "b1", serviceId: null, label: "Reliure plein cuir", description: null, unit: null,
  quantity: 1, unitPriceCents: 18000, catalogPriceCents: null, vatRateBps: 2000, totalHtCents: 18000, photos: [], ...overrides,
});

const compliance = {
  serviceDate: "2026-10-30", dueDate: "2026-11-30", operationNature: "services", clientType: "business",
  clientLegalName: "Bibliothèque Exemple SAS", billingAddressLine1: "1 rue Neuve", billingPostalCode: "75006", billingCity: "Paris", billingCountry: "FR",
  clientSiren: "552 100 554", clientVatNumber: null, purchaseOrderNumber: null, publicServiceCode: null, publicCommitmentNumber: null,
  deliveryAddressLine1: null, deliveryPostalCode: null, deliveryCity: null, deliveryCountry: null,
  earlyPaymentDiscountTerms: "Pas d'escompte.", latePenaltyTerms: "Trois fois le taux légal.", legalMentions: [],
};

function invoice(overrides: Record<string, unknown> = {}, complianceOverrides: Record<string, unknown> = {}): DocumentView {
  return {
    kind: "invoice", id: "i1", number: "F-2026-0001", status: "issued", issueDate: "2026-11-01", validUntil: null,
    client: { id: null, name: "Client", email: "client@example.com", phone: "0102030405", addressLine1: "1 rue Neuve", postalCode: "75006", city: "Paris", country: "FR" },
    book: { title: null, author: null, heightMm: null, widthMm: null, spineMm: null, notes: null },
    blocks: [{ key: "b1", label: "Lot", bookCount: 1, heightMm: null, widthMm: null, spineMm: null }],
    items: [item()], currency: "EUR",
    issuer: {
      workshopName: "Atelier d'exemple", binderName: null, legalName: "Exemple SARL", legalForm: "SARL", shareCapital: "5 000 €", siren: "732 829 320",
      addressLine1: "9 rue Pothier", addressLine2: null, postalCode: "78000", city: "Versailles", country: "FR", siret: "73282932000074", vatNumber: "FR44 732829320",
      vatOnDebits: false, legalNotes: null, email: null, phone: null, website: null, logoStoragePath: null, logoUrl: null, documentAccentColor: null, documentFooter: null,
      iban: "FR76 3000 6000 0112 3456 7890 189",
    },
    vatRegime: "VAT_LIABLE", vatMention: null, paymentTerms: "30 jours", notes: null,
    subtotalCents: 18000, discountType: "NONE", discountValue: 0, discountCents: 0, totalHtCents: 18000, totalVatCents: 3600, totalTtcCents: 21600,
    vatBreakdown: [{ vatRateBps: 2000, baseHtCents: 18000, vatCents: 3600 }],
    depositType: "NONE", depositValue: 0, depositCents: 0, balanceCents: 21600,
    linkedQuoteId: null, linkedQuoteNumber: null, linkedInvoiceId: null, linkedInvoiceNumber: null, createdAt: "2026-11-01T10:00:00Z",
    payment: null, creditNote: null,
    invoiceCompliance: { ...compliance, ...complianceOverrides },
    ...overrides,
  } as unknown as DocumentView;
}

const built = (document: DocumentView | CreditNoteDocumentView): EnInvoice => {
  const result = buildEnInvoice(document);
  if (!result.ok) throw new Error(result.blockers.join(","));
  return result.invoice;
};
const blockers = (document: DocumentView | CreditNoteDocumentView) => {
  const result = buildEnInvoice(document);
  return result.ok ? [] : result.blockers;
};

describe("facture vers EN 16931", () => {
  it("traduit une prestation à un professionnel", () => {
    const result = buildEnInvoice(invoice());
    expect(result.ok && result.processingRule).toBe("B2B");
    const value = built(invoice());
    expect(value).toMatchObject({ number: "F-2026-0001", type_code: 380, payment_due_date: "2026-11-30" });
    expect(value.process_control.business_process_type).toBe("S1");
    expect(value.seller.legal_registration_identifier).toEqual({ value: "732829320", scheme: "0002" });
    expect(value.seller.vat_identifier).toBe("FR44732829320");
    expect(value.seller.trading_name).toBe("Atelier d'exemple");
    expect(value.buyer.electronic_address).toEqual({ value: "552100554", scheme: "0225" });
    expect(value.totals).toMatchObject({ total_without_vat: "180.00", total_with_vat: "216.00", amount_due_for_payment: "216.00" });
    expect(value.payment_instructions?.credit_transfers[0].payment_account_identifier.value).toBe("FR7630006000011234567890189");
  });

  it("préfère l'adresse lue dans l'annuaire", () => {
    const result = buildEnInvoice(invoice(), { sellerElectronicAddress: "732829320_ATELIER", buyerElectronicAddress: "552100554_COMPTA" });
    if (!result.ok) throw new Error("refusée");
    expect(result.invoice.seller.electronic_address.value).toBe("732829320_ATELIER");
    expect(result.invoice.buyer.electronic_address?.value).toBe("552100554_COMPTA");
  });

  it("donne le cadre de facturation selon la nature", () => {
    expect(built(invoice({}, { operationNature: "goods" })).process_control.business_process_type).toBe("B1");
    expect(built(invoice({}, { operationNature: "mixed" })).process_control.business_process_type).toBe("M1");
  });

  it("multiplie la quantité par le nombre de livres du lot", () => {
    const document = invoice({ blocks: [{ key: "b1", label: "Lot", bookCount: 3, heightMm: null, widthMm: null, spineMm: null }], items: [item({ unitPriceCents: 6000 })] });
    expect(built(document).lines[0]).toMatchObject({ invoiced_quantity: "3", net_amount: "180.00" });
  });

  it("porte la remise par taux sur la base figée", () => {
    const document = invoice({
      items: [item({ totalHtCents: 10000, unitPriceCents: 10000 }), item({ lineKey: "l2", totalHtCents: 10000, unitPriceCents: 10000, vatRateBps: 550 })],
      subtotalCents: 20000, discountType: "PERCENT", discountValue: 1000, discountCents: 2000, totalHtCents: 18000, totalVatCents: 2295, totalTtcCents: 20295,
      vatBreakdown: [{ vatRateBps: 2000, baseHtCents: 9000, vatCents: 1800 }, { vatRateBps: 550, baseHtCents: 9000, vatCents: 495 }],
    });
    const value = built(document);
    expect(value.document_level_allowances?.map((allowance) => [allowance.vat_rate, allowance.amount])).toEqual([["20.00", "10.00"], ["5.50", "10.00"]]);
    expect(value.totals.sum_allowances_amount).toBe("20.00");
    expect(value.vat_break_down).toHaveLength(2);
  });

  it("traduit la franchise avec son motif, sans numéro de TVA", () => {
    const document = invoice({
      vatRegime: "FRANCHISE", vatMention: "TVA non applicable, art. 293 B du CGI", totalVatCents: 0, totalTtcCents: 18000,
      vatBreakdown: [{ vatRateBps: 0, baseHtCents: 18000, vatCents: 0 }],
      issuer: { ...invoice().issuer, vatNumber: null },
    });
    const value = built(document);
    expect(value.seller.vat_identifier).toBeUndefined();
    expect(value.seller.tax_registration_identifier).toBe("732829320");
    expect(value.vat_break_down[0]).toMatchObject({ vat_category_code: "E", vat_category_rate: "0.00", vat_exemption_reason_code: "VATEX-FR-FRANCHISE" });
    expect(value.lines[0].vat_information).toEqual({ invoiced_item_vat_category_code: "E", invoiced_item_vat_rate: "0.00" });
  });

  it("marque une vente à un particulier, adressée par son e-mail, sans son téléphone", () => {
    const document = invoice({}, { clientType: "individual", clientSiren: null, clientLegalName: null });
    const result = buildEnInvoice(document);
    expect(result.ok && result.processingRule).toBe("B2C");
    const value = built(document);
    expect(value.notes[0]).toEqual({ subject_code: "BAR", note: "B2C" });
    expect(JSON.stringify(value)).not.toContain("0102030405");
    expect(value.buyer.electronic_address).toEqual({ value: "client@example.com", scheme: "EM" });
  });

  it("rattache un avoir à sa facture", () => {
    const credit = { ...invoice({}, { dueDate: null }), kind: "credit_note", number: "A-2026-0001", originalInvoice: { number: "F-2026-0001", issueDate: "2026-11-01" }, reason: "Geste commercial" } as unknown as CreditNoteDocumentView;
    const value = built(credit);
    expect(value.type_code).toBe(381);
    expect(value.preceding_invoice_references).toEqual([{ reference: "F-2026-0001", issue_date: "2026-11-01" }]);
    expect(value.payment_due_date).toBeUndefined();
    expect(value.payment_instructions).toBeUndefined();
    expect(value.notes).toContainEqual({ subject_code: "ACD", note: "Geste commercial" });
  });
});

describe("pièces refusées", () => {
  it("un brouillon ou un devis", () => {
    expect(blockers(invoice({ status: "draft" }))).toContain("not_issued");
    expect(blockers(invoice({ kind: "quote" }))).toContain("not_issued");
  });

  it("une vente mixte à un particulier", () => {
    expect(blockers(invoice({}, { clientType: "individual", clientSiren: null, operationNature: "mixed" }))).toEqual(["b2c_mixed"]);
  });

  it("un particulier sans e-mail", () => {
    const client = { ...invoice().client, email: null };
    expect(blockers(invoice({ client }, { clientType: "individual", clientSiren: null }))).toEqual(["missing_buyer_address"]);
  });

  it("un professionnel étranger, déclaré en e-reporting plutôt que facturé par la plateforme", () => {
    expect(blockers(invoice({}, { billingCountry: "BE", clientSiren: null, clientVatNumber: "BE0123456749" }))).toEqual(["international_reporting_only"]);
  });

  it("une entité publique, tant que le circuit public n'est pas couvert", () => {
    expect(blockers(invoice({}, { clientType: "public_entity" }))).toContain("unsupported_public_entity");
  });

  it("un taux nul sans motif d'exonération", () => {
    const document = invoice({ items: [item({ vatRateBps: 0 })], totalVatCents: 0, totalTtcCents: 18000, vatBreakdown: [{ vatRateBps: 0, baseHtCents: 18000, vatCents: 0 }] });
    expect(blockers(document)).toContain("zero_rate_without_reason");
  });

  it("des montants qui ne se recoupent pas", () => {
    expect(blockers(invoice({ totalTtcCents: 21601 }))).toContain("amounts_mismatch");
    expect(blockers(invoice({ subtotalCents: 17999 }))).toContain("amounts_mismatch");
    expect(blockers(invoice({ totalVatCents: 3599 }))).toContain("amounts_mismatch");
  });

  it("une identité incomplète", () => {
    expect(blockers(invoice({ issuer: { ...invoice().issuer, siren: null } }))).toContain("missing_seller_identity");
    expect(blockers(invoice({ issuer: { ...invoice().issuer, vatNumber: null } }))).toContain("missing_seller_identity");
    expect(blockers(invoice({}, { clientSiren: null }))).toContain("missing_buyer_identity");
  });

  it("une pièce sans données de conformité, une devise étrangère", () => {
    expect(blockers(invoice({ invoiceCompliance: null }))).toContain("missing_compliance");
    expect(blockers(invoice({ currency: "USD" }))).toContain("unsupported_currency");
  });
});
