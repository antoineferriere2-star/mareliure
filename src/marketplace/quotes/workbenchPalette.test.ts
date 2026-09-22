import { describe, expect, it } from "vitest";
import { resolvePricePalette, recentServices } from "./workbenchPalette";
import { lineFromBasePrice } from "./quoteLines";
import { duplicateQuoteInput } from "./duplicateQuote";
import type { DocumentView } from "./quoteViews";

const ID = "8d7a8c8e-6c53-4a1c-9a36-0d1f3c0d8a01";

describe("palette et duplication de devis", () => {
  it("le tarif atelier prime sur la base par nom ou référence exacte", () => {
    const base = [
      { pricingKey: "plein_cuir", label: "Plein cuir", unit: "ouvrage", unitPriceCents: 35000, pricingMode: "fixed" },
      { pricingKey: "nerfs", label: "Nerfs", unit: "nerf", unitPriceCents: 1200, pricingMode: "unit" },
    ];
    const workshop = [{ id: ID, name: "Plein cuir", referenceOperationKey: null, isActive: true, unitPriceCents: 39000 }];
    const resolved = resolvePricePalette(workshop, base);
    expect(resolved.workshop).toHaveLength(1);
    expect(resolved.base.map((item) => item.pricingKey)).toEqual(["nerfs"]);
    expect(lineFromBasePrice(base[1], 2000, "k")).toMatchObject({ unitPriceCents: 1200, unit: "nerf", referenceOperationKey: "OPR-0045" });
  });

  it("les récentes restent propres à la liste de l'atelier et sans doublon", () => {
    expect(recentServices([{ id: "a" }, { id: "b" }], ["b", "b", "étranger", "a"]).map((item) => item.id)).toEqual(["b", "a"]);
  });

  it("la duplication garde le chiffrage figé et laisse le serveur créer un nouveau numéro", () => {
    const doc = {
      kind: "quote", status: "accepted", number: "D-2026-0042", issueDate: "2026-09-01", validUntil: "2026-10-01",
      client: { id: ID, name: "Jean Dupont", email: null, phone: null, addressLine1: null, postalCode: null, city: null, country: null },
      book: { title: "Les Misérables", author: null, heightMm: 220, widthMm: 145, spineMm: 32, notes: null },
      items: [{ position: 1, serviceId: ID, label: "Plein cuir", description: null, unit: "ouvrage", quantity: 1,
        unitPriceCents: 39000, catalogPriceCents: 35000, vatRateBps: 2000, totalHtCents: 39000,
        referenceVersion: "reliure-fr-v1", referenceOperationKey: "OPR-0064" }],
      discountType: "AMOUNT", discountValue: 1000, depositType: "NONE", depositValue: 0,
      notes: "Conditions inchangées", linkedInvoiceId: ID,
    } as unknown as DocumentView;
    const input = duplicateQuoteInput(doc);
    expect(input.lines[0]).toMatchObject({ serviceId: null, unitPriceCents: 39000, referenceOperationKey: "OPR-0064" });
    expect(input.validityDays).toBe(30);
    expect(input.discount).toEqual({ type: "AMOUNT", cents: 1000 });
    expect(JSON.stringify(input)).not.toMatch(/D-2026-0042|accepted|linkedInvoiceId/);
  });
});
