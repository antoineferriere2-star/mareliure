import { describe, expect, it } from "vitest";
import { renderDocumentPdf } from "@/marketplace/quotes/documentPdf";
import { oppeCreditNoteDocument, oppeInvoiceDocument, oppeSellerSnapshot, serviceLineLabel, type OppeInvoiceRecord } from "./oppeInvoice";

const invoice: OppeInvoiceRecord = {
  id: "00000000-0000-4000-8000-000000000001",
  number: "MR-2026-00001",
  issue_date: "2026-10-05",
  brand: "MA_RELIURE",
  seller: oppeSellerSnapshot("MA_RELIURE", "CUSTOMER"),
  customer: {
    type: "CUSTOMER", name: "Client Test", business_name: null, vat_number: null, address_line1: "1 rue du Livre",
    address_line2: null, postal_code: "75001", city: "Paris", country: "FR", email: "client@example.test",
  },
  currency: "EUR",
  total_ht_cents: 21250,
  total_vat_cents: 4250,
  total_ttc_cents: 25500,
  vat_breakdown: [{ rate_bps: 2000, base_ht_cents: 21250, vat_cents: 4250 }],
  payment: { paid_at: "2026-10-05T10:00:00.000Z", method: "card" },
  issued_at: "2026-10-05T10:00:01.000Z",
};
const items = [
  { position: 1, label: serviceLineLabel({ brand: "MA_RELIURE", reference: "RL-001", serviceDescription: "Reliure demi-cuir" }), category: "service", quantity: 1, unit_ht_cents: 20000, vat_rate_bps: 2000, total_ht_cents: 20000, vat_cents: 4000, total_ttc_cents: 24000 },
  { position: 2, label: "Transport aller-retour (forfait)", category: "shipping", quantity: 1, unit_ht_cents: 1250, vat_rate_bps: 2000, total_ht_cents: 1250, vat_cents: 250, total_ttc_cents: 1500 },
];

describe("facture de vente Oppe", () => {
  it("désigne OPPE SAS comme vendeur, sous la marque", () => {
    const seller = oppeSellerSnapshot("FINE_BINDERY", "CUSTOMER");
    expect(seller.legal_name).toBe("OPPE SAS");
    expect(seller.brand).toBe("Fine Bindery");
    expect(seller.legal_mentions[0]).toContain("Fine Bindery est une marque d'OPPE SAS");
    expect(seller.legal_mentions.join(" ")).toContain("FR55 943 317 610");
  });

  it("ajoute les pénalités de retard pour un client professionnel seulement", () => {
    expect(oppeSellerSnapshot("MA_RELIURE", "BUSINESS").legal_mentions.join(" ")).toContain("40 €");
    expect(oppeSellerSnapshot("MA_RELIURE", "CUSTOMER").legal_mentions.join(" ")).not.toContain("40 €");
  });

  it("s'imprime avec numéro, vendeur, client, lignes et totaux", async () => {
    const pdf = await renderDocumentPdf(oppeInvoiceDocument(invoice, items));
    const text = pdf.printed.join("\n");
    expect(pdf.pageCount).toBeGreaterThanOrEqual(1);
    for (const needle of ["MR-2026-00001", "OPPE SAS", "Ma Reliure", "Client Test", "Reliure demi-cuir", "Transport aller-retour"]) {
      expect(text).toContain(needle);
    }
    expect(text).toMatch(/255,00/);
  });

  it("imprime l'avoir rattaché à la facture d'origine", async () => {
    const pdf = await renderDocumentPdf(oppeCreditNoteDocument(invoice, {
      id: "00000000-0000-4000-8000-000000000002", number: "MR-AV-2026-00001", issue_date: "2026-10-06", reason: "Remboursement du transport",
      issued_at: "2026-10-06T10:00:00.000Z",
      items: [{ position: 2, label: "Transport aller-retour (forfait)", vat_rate_bps: 2000, total_ht_cents: -1250, vat_cents: -250, total_ttc_cents: -1500 }],
      total_ht_cents: 1250, total_vat_cents: 250, total_ttc_cents: 1500,
      vat_breakdown: [{ rate_bps: 2000, base_ht_cents: -1250, vat_cents: -250 }],
    }));
    const text = pdf.printed.join("\n");
    expect(text).toContain("MR-AV-2026-00001");
    expect(text).toContain("MR-2026-00001");
    expect(text).toContain("Remboursement du transport");
  });
});
