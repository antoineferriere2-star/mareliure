import { describe, expect, it } from "vitest";
import { WORK_ITEMS } from "./catalog";
import {
  BASE_PRICE_PRICING_MODES,
  PRICEABLE_SERVICE_MAPPINGS,
  assertCompleteBasePriceMapping,
  matchesBasePriceFilter,
  validateBasePriceDraft,
} from "./basePrices";

describe("tarifs de base Ma Reliure", () => {
  it("porte un mapping technique pour chacune des 45 prestations", () => {
    expect(PRICEABLE_SERVICE_MAPPINGS).toHaveLength(WORK_ITEMS.length);
    expect(() => assertCompleteBasePriceMapping()).not.toThrow();
  });

  it("supporte les quatre modes tarifaires", () => {
    expect(BASE_PRICE_PRICING_MODES).toEqual(["fixed", "unit", "starting_from", "manual_review"]);
  });

  it("distingue zéro d’un tarif sur étude", () => {
    expect(validateBasePriceDraft({ pricingMode: "fixed", defaultUnitPriceCents: 0, unit: "ouvrage" })).toEqual([]);
    expect(validateBasePriceDraft({ pricingMode: "manual_review", defaultUnitPriceCents: null, unit: "ouvrage" })).toEqual([]);
    expect(validateBasePriceDraft({ pricingMode: "manual_review", defaultUnitPriceCents: 0, unit: "ouvrage" })).not.toEqual([]);
  });

  it("refuse un prix numérique absent hors sur étude", () => {
    expect(validateBasePriceDraft({ pricingMode: "unit", defaultUnitPriceCents: null, unit: "ligne" })).not.toEqual([]);
  });

  it("filtre les lignes par état et recherche", () => {
    const row = {
      label: "Pleine toile",
      pricingKey: "pleine_toile",
      pricingMode: "fixed" as const,
      defaultUnitPriceCents: 0,
      needsHumanValidation: true,
      hasEntry: true,
    };
    expect(matchesBasePriceFilter(row, "numeric", "toile")).toBe(true);
    expect(matchesBasePriceFilter(row, "manual_review", "")).toBe(false);
    expect(matchesBasePriceFilter(row, "needs_validation", "")).toBe(true);
    expect(matchesBasePriceFilter(row, "modified", "pleine")).toBe(true);
  });
});
