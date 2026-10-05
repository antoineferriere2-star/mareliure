import { describe, expect, it } from "vitest";
import { renderDocumentPdf } from "@/marketplace/quotes/documentPdf";
import type { BillingProfile } from "@/marketplace/quotes/quoteBuild";
import { supplierInvoiceDocument, supplierInvoiceNumber } from "./supplierInvoice";

const profile = {
  workshopName: "Atelier Test", binderName: null, legalName: "Atelier Test EI", legalForm: null, shareCapital: null, siren: "123456789",
  addressLine1: "2 rue des Relieurs", addressLine2: null, postalCode: "69001", city: "Lyon", country: "FR", siret: "12345678900011",
  vatNumber: "FR12123456789", vatOnDebits: false, legalNotes: null, email: "atelier@example.test", phone: null, website: null,
  logoStoragePath: null, logoUrl: null, documentAccentColor: "#241a12", documentFooter: null, vatRegime: "VAT_LIABLE", defaultVatRateBps: 2000,
  vatMention: null, quotePrefix: "D", invoicePrefix: "FA", quoteValidityDays: 30, paymentTerms: null,
} as unknown as BillingProfile;

describe("facture de l'atelier à Oppe", () => {
  it("porte un numéro propre à l'atelier, unique par dossier", () => {
    expect(supplierInvoiceNumber(profile, "RL-2026-0042")).toBe("FA-OPPE-RL-2026-0042");
  });

  it("s'imprime au nom de l'atelier, adressée à OPPE SAS, montant HT de l'accord et TVA d'achat distincte", async () => {
    const pdf = await renderDocumentPdf(supplierInvoiceDocument({
      profile, number: "FA-OPPE-RL-1", issueDate: "2026-10-05", dueDate: "2026-11-04", caseReference: "RL-1",
      serviceDescription: "Reliure demi-cuir", amountHtCents: 15000, vatRegime: "VAT_LIABLE", vatRateBps: 2000, vatCents: 3000, vatMention: null,
    }));
    const text = pdf.printed.join("\n");
    for (const needle of ["FA-OPPE-RL-1", "Atelier Test", "OPPE SAS", "Reliure demi-cuir", "150,00", "180,00"]) expect(text).toContain(needle);
    expect(text).toMatch(/30 jours/);
  });

  it("porte la mention de franchise sans TVA", async () => {
    const doc = supplierInvoiceDocument({
      profile: { ...profile, vatRegime: "FRANCHISE" } as BillingProfile, number: "FA-OPPE-RL-2", issueDate: "2026-10-05", dueDate: "2026-11-04", caseReference: "RL-2",
      serviceDescription: null, amountHtCents: 15000, vatRegime: "FRANCHISE", vatRateBps: null, vatCents: 0, vatMention: "TVA non applicable, art. 293 B du CGI",
    });
    expect(doc.totalVatCents).toBe(0);
    expect(doc.totalTtcCents).toBe(15000);
    expect(doc.vatMention).toContain("293 B");
  });
});
