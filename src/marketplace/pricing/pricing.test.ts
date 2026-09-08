import { describe, expect, it } from "vitest";
import { buildCaseProfile } from "@/marketplace/cases/caseProfile";
import { suggestManagedPrice, validateManagedPrice } from "./pricing.engine";

describe("managed pricing", () => {
  it("pins the reference half-leather case", () => {
    const profile = buildCaseProfile({
      intention: "belle_reliure",
      hauteur: 29.7,
      largeur: 21,
      epaisseur: 12,
      etatDos: "fendu",
      cahiers: "desolidarises",
      materiau: "demi_cuir",
      finitions: ["dorure", "titre", "nerfs"],
      nerfs: 5,
    });

    expect(suggestManagedPrice(profile)).toMatchObject({
      suggestedCustomerPriceCents: 49_000,
      suggestedBinderPayoutCents: 40_000,
      suggestedMarginCents: 9_000,
      confidence: "high",
    });
  });

  it("rejects an inverted split and a margin below policy", () => {
    expect(validateManagedPrice(40_000, 41_000).valid).toBe(false);
    expect(validateManagedPrice(40_000, 39_000).valid).toBe(false);
    expect(validateManagedPrice(49_000, 40_000).valid).toBe(true);
  });

  it("is total for sparse structured answers", () => {
    const result = suggestManagedPrice(buildCaseProfile({}));
    expect(result.confidence).toBe("low");
    expect(result.suggestedCustomerPriceCents).toBeGreaterThan(result.suggestedBinderPayoutCents);
  });
});
