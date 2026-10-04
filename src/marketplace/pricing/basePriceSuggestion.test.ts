import { describe, expect, it } from "vitest";
import { BASE_PRICE_NOTE, suggestFromBasePrices, type BasePriceReference } from "./basePriceSuggestion";
import { PRICING_POLICY } from "./pricing.rules";
import { validateManagedPrice } from "./pricing.engine";

const refs: BasePriceReference[] = [
  { pricingKey: "reparation_dos", defaultUnitPriceCents: 9000, pricingMode: "unit", unit: "dos" },
  { pricingKey: "reemboitage", defaultUnitPriceCents: 6000, pricingMode: "fixed", unit: "ouvrage" },
  { pricingKey: "restauration_patrimoniale", defaultUnitPriceCents: null, pricingMode: "manual_review", unit: null },
];
const work = (keys: string[], sizeClass = "standard", complexityClass = "standard") => ({ workItemKeys: keys, sizeClass, complexityClass });

describe("la suggestion « tarifs de base »", () => {
  it("lit le tarif de base comme rémunération atelier et en déduit le prix client par les règles Ma Reliure", () => {
    const s = suggestFromBasePrices(work(["reparation_dos"]), refs)!;
    expect(s.suggestedBinderPayoutCents).toBe(9000);
    // Contribution minimale (80 €) au-dessus de la rémunération, arrondie à 10 € : 170 €.
    expect(s.suggestedCustomerPriceCents).toBe(9000 + PRICING_POLICY.minimumContributionCents);
    expect(s.priceBoundBy).toBe("contribution_floor");
    expect(validateManagedPrice(s.suggestedCustomerPriceCents!, s.suggestedBinderPayoutCents!).valid).toBe(true);
  });

  it("additionne les travaux et dit, pour chacun, que le tarif n'est pas validé", () => {
    const s = suggestFromBasePrices(work(["reparation_dos", "reemboitage"]), refs)!;
    expect(s.suggestedBinderPayoutCents).toBe(15000);
    expect(s.confidence).toBe("low");
    expect(s.status).toBe("suggested");
    for (const c of s.components) {
      expect(c.approximated).toBe(true);
      expect(c.approximationNote!.startsWith(BASE_PRICE_NOTE)).toBe(true);
    }
    expect(s.components[0].approximationNote).toContain("prix par dos, quantité 1");
    expect(s.ruleVersion).toContain("base-prices-v1");
  });

  it("s'abstient dès qu'un travail n'a pas de tarif chiffré : jamais une somme partielle", () => {
    expect(suggestFromBasePrices(work(["reparation_dos", "restauration_patrimoniale"]), refs)).toBeNull();
    expect(suggestFromBasePrices(work(["reparation_dos", "inconnu"]), refs)).toBeNull();
    expect(suggestFromBasePrices(work([]), refs)).toBeNull();
  });

  it("signale un format ou une complexité que les tarifs de base ne distinguent pas", () => {
    const s = suggestFromBasePrices(work(["reemboitage"], "large", "standard"), refs)!;
    expect(s.factors.join(" ")).toMatch(/hors standard/);
  });
});
