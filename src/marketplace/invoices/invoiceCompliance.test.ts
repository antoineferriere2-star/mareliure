import { describe, expect, it } from "vitest";
import { invoiceLegalMentions, validateInvoiceForIssue, type InvoiceIssueCandidate } from "./invoiceCompliance";

const candidate = (patch: Partial<InvoiceIssueCandidate> = {}): InvoiceIssueCandidate => ({
  status: "draft",
  issueDate: "2026-09-23",
  serviceDate: "2026-09-23",
  dueDate: "2026-10-23",
  operationNature: "services",
  issuer: {
    workshopName: "Atelier Test", binderName: null, legalName: "Atelier Test SARL", legalForm: "SARL",
    shareCapital: "10 000 €", siren: "732829320", addressLine1: "1 rue du Livre", addressLine2: null,
    postalCode: "75001", city: "Paris", country: "FR", siret: "73282932000009", vatNumber: "FR00123456789",
    vatOnDebits: false, vatFilingRegime: "reel_normal", legalNotes: null, email: "atelier@example.fr", phone: null, website: null,
    logoStoragePath: null, documentAccentColor: "#7A2230", documentFooter: null, iban: null,
  },
  buyer: {
    type: "business", name: "Cliente", legalName: "Cliente SAS", email: null, phone: null,
    addressLine1: "2 rue Client", postalCode: "69001", city: "Lyon", country: "FR",
    billingAddressLine1: null, billingPostalCode: null, billingCity: null, billingCountry: null,
    siren: "552100554", vatNumber: null, purchaseOrderNumber: null, publicServiceCode: null, publicCommitmentNumber: null,
  },
  vatRegime: "VAT_LIABLE", vatMention: null, paymentTerms: "30 jours",
  earlyPaymentDiscountTerms: "Pas d'escompte pour paiement anticipé.",
  latePenaltyTerms: "Pénalités : trois fois le taux légal.",
  items: [{ label: "Reliure", quantity: 1, unitPriceCents: 10000, vatRateBps: 2000 }],
  ...patch,
});

describe("validateInvoiceForIssue", () => {
  it("valide une société à TVA normale, y compris à 20 %", () => expect(validateInvoiceForIssue(candidate()).valid).toBe(true));
  it("accepte une EI et une TVA à 5,5 %", () => {
    const value = candidate({ items: [{ label: "Livre", quantity: 1, unitPriceCents: 10000, vatRateBps: 550 }] });
    value.issuer.legalForm = "EI";
    expect(validateInvoiceForIssue(value).valid).toBe(true);
  });
  it("conserve techniquement plusieurs taux", () => {
    const value = candidate({ items: [
      { label: "Livre", quantity: 1, unitPriceCents: 10000, vatRateBps: 550 },
      { label: "Service", quantity: 1, unitPriceCents: 5000, vatRateBps: 2000 },
    ] });
    expect(validateInvoiceForIssue(value).valid).toBe(true);
  });
  it("exige la date de prestation et l'échéance", () => {
    const result = validateInvoiceForIssue(candidate({ serviceDate: null, dueDate: null }));
    expect(result.missing).toEqual(expect.arrayContaining(["Date de prestation manquante", "Échéance de paiement manquante"]));
  });
  it("exige le SIREN d'un professionnel facturé en France, pas hors de France", () => {
    const french = candidate();
    french.buyer = { ...french.buyer, siren: null };
    expect(validateInvoiceForIssue(french).missing).toContain("SIREN du client professionnel manquant");
    const belgian = candidate();
    belgian.buyer = { ...belgian.buyer, siren: null, billingCountry: "BE" };
    expect(validateInvoiceForIssue(belgian).valid).toBe(true);
  });
  it("contrôle la clé des SIREN et SIRET, et que le SIRET prolonge le SIREN", () => {
    const value = candidate();
    value.issuer = { ...value.issuer, siren: "732829321", siret: "73282932000008" };
    value.buyer = { ...value.buyer, siren: "552100555" };
    expect(validateInvoiceForIssue(value).missing).toEqual(expect.arrayContaining([
      "SIREN atelier invalide (clé de contrôle)", "SIRET atelier invalide (clé de contrôle)", "SIREN client invalide (clé de contrôle)",
    ]));
    const other = candidate();
    other.issuer = { ...other.issuer, siret: "55210055400013" };
    expect(validateInvoiceForIssue(other).missing).toContain("Le SIRET atelier ne commence pas par son SIREN");
  });
  it("refuse un pays saisi en clair et exige le régime d'imposition d'un assujetti", () => {
    const value = candidate();
    value.buyer = { ...value.buyer, billingCountry: "Belgique" };
    value.issuer = { ...value.issuer, vatFilingRegime: null };
    expect(validateInvoiceForIssue(value).missing).toEqual(expect.arrayContaining([
      "Pays de facturation du client à choisir dans la liste",
      "Régime d'imposition de la TVA atelier manquant (réel simplifié ou réel normal)",
    ]));
  });
  it("n'exige pas de mention en franchise : elle est posée d'office", () => {
    const franchise = candidate({ vatRegime: "FRANCHISE", vatMention: null });
    expect(validateInvoiceForIssue(franchise).valid).toBe(true);
    expect(invoiceLegalMentions(franchise)).toContain("TVA non applicable, art. 293 B du CGI");
  });
  it("refuse une échéance antérieure à l'émission", () => {
    expect(validateInvoiceForIssue(candidate({ dueDate: "2026-09-22" })).missing)
      .toContain("Échéance de paiement antérieure à la date d'émission");
  });
  it("exige l'identité d'une entité publique", () => {
    const value = candidate();
    value.buyer = { ...value.buyer, type: "public_entity", legalName: null, siren: null };
    expect(validateInvoiceForIssue(value).missing).toEqual(expect.arrayContaining([
      "Nom de l'entité publique manquant",
      "SIREN de l'entité publique manquant",
    ]));
  });
  it("ajoute les mentions B2B et les omet pour un particulier", () => {
    expect(invoiceLegalMentions(candidate())).toEqual(expect.arrayContaining([expect.stringContaining("40 €")]));
    const individual = candidate();
    individual.buyer.type = "individual";
    expect(invoiceLegalMentions(individual).join(" ")).not.toContain("40 €");
  });
  it("fige la franchise et l'option sur les débits selon le contexte", () => {
    const value = candidate({ vatRegime: "FRANCHISE", vatMention: "TVA non applicable, art. 293 B du CGI" });
    value.issuer.vatNumber = null;
    value.issuer.vatOnDebits = true;
    expect(invoiceLegalMentions(value)).toEqual(expect.arrayContaining([
      "TVA non applicable, art. 293 B du CGI",
      "Option pour le paiement de la taxe d'après les débits",
    ]));
  });
});
