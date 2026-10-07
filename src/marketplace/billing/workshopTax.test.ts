import { describe, expect, it } from "vitest";
import { frenchWorkshopTaxEligibility, isFrenchSubscriptionTaxRate, workshopFeeTax, workshopFeeCredit } from "./workshopTax";
const profile = { country: "FR", postal_code: "75001", city: "Paris", address_line1: "Adresse de recette",
  legal_name: "Atelier de recette", workshop_name: null, vat_regime: "FRANCHISE", vat_number: null };
describe("TVA B/C approuvée administrativement", () => {
  it("collecte la TVA Oppe même si le client professionnel est en franchise", () => {
    expect(frenchWorkshopTaxEligibility(profile)).toBeNull();
    expect(frenchWorkshopTaxEligibility({ ...profile, country: "BE" })).toContain("individuelle");
    expect(frenchWorkshopTaxEligibility({ ...profile, postal_code: "97100" })).toContain("individuelle");
    expect(frenchWorkshopTaxEligibility({ ...profile, address_line1: null })).toContain("Complétez");
    expect(frenchWorkshopTaxEligibility(null)).toContain("Complétez");
  });
  it("refuse un taux inclus, archivé ou d'un autre pays", () => {
    const rate = { active: true, percentage: 20, inclusive: false, country: "FR", tax_type: "vat" };
    expect(isFrenchSubscriptionTaxRate(rate)).toBe(true);
    for (const change of [{ inclusive: true }, { active: false }, { country: "BE" }, { percentage: 5.5 }])
      expect(isFrenchSubscriptionTaxRate({ ...rate, ...change })).toBe(false);
  });
  it("100 € encaissés donnent 3 € de frais, dont 2,50 € HT et 0,50 € TVA", () => {
    expect(workshopFeeTax(300)).toEqual({ grossCents: 300, netCents: 250, vatCents: 50 });
  });
  it("conserve les centimes sur de petits frais et tous les remboursements successifs", () => {
    for (let amount = 1; amount <= 400; amount++) {
      const original = workshopFeeTax(amount);
      let net = 0, vat = 0;
      for (let refunded = 1; refunded <= amount; refunded++) {
        const credit = workshopFeeCredit(refunded - 1, refunded, amount);
        net += credit.netCents; vat += credit.vatCents;
        expect(credit.netCents + credit.vatCents).toBe(1);
      }
      expect({ net, vat }).toEqual({ net: original.netCents, vat: original.vatCents });
    }
    expect(() => workshopFeeCredit(4, 3, 5)).toThrow();
    expect(() => workshopFeeCredit(0, 6, 5)).toThrow();
  });
});
