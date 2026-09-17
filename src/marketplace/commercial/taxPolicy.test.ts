import { describe, expect, it } from "vitest";
import {
  isCommercialTaxPolicy,
  recomputeProposalTax,
  suggestTaxPolicyForCountry,
  validateTaxPolicySelection,
} from "./taxPolicy";

describe("isCommercialTaxPolicy", () => {
  it("accepte les cinq catégories connues, rejette tout le reste", () => {
    expect(isCommercialTaxPolicy("MANUAL_TAX_REVIEW")).toBe(true);
    expect(isCommercialTaxPolicy("FR_B2C")).toBe(true);
    expect(isCommercialTaxPolicy("EU_B2C")).toBe(true);
    expect(isCommercialTaxPolicy("NON_EU_B2C")).toBe(true);
    expect(isCommercialTaxPolicy("NON_EU_TEMPORARY_IMPORT_REEXPORT")).toBe(true);
    expect(isCommercialTaxPolicy("TAX_REVIEW_REQUIRED")).toBe(false);
    expect(isCommercialTaxPolicy("FR_STANDARD")).toBe(false);
  });
});

/**
 * Une suggestion de pré-remplissage, jamais une décision (§6, §10 du brief
 * du 17 septembre 2026) — `checkoutEligibility` ne l'appelle jamais.
 */
describe("suggestTaxPolicyForCountry", () => {
  it("MANUAL_TAX_REVIEW quand le pays est inconnu", () => {
    expect(suggestTaxPolicyForCountry(null)).toBe("MANUAL_TAX_REVIEW");
    expect(suggestTaxPolicyForCountry("")).toBe("MANUAL_TAX_REVIEW");
  });

  it("FR_B2C pour la France", () => {
    expect(suggestTaxPolicyForCountry("FR")).toBe("FR_B2C");
    expect(suggestTaxPolicyForCountry("fr")).toBe("FR_B2C");
  });

  it("EU_B2C pour un autre État membre", () => {
    expect(suggestTaxPolicyForCountry("DE")).toBe("EU_B2C");
    expect(suggestTaxPolicyForCountry("IT")).toBe("EU_B2C");
  });

  it("NON_EU_B2C pour un pays hors UE reconnu", () => {
    expect(suggestTaxPolicyForCountry("US")).toBe("NON_EU_B2C");
    expect(suggestTaxPolicyForCountry("GB")).toBe("NON_EU_B2C");
  });

  it("ne suggère jamais NON_EU_TEMPORARY_IMPORT_REEXPORT — un fait qu'un code pays ne peut pas révéler", () => {
    for (const code of ["FR", "DE", "US", "JP", null]) {
      expect(suggestTaxPolicyForCountry(code)).not.toBe("NON_EU_TEMPORARY_IMPORT_REEXPORT");
    }
  });
});

describe("validateTaxPolicySelection", () => {
  it("refuse MANUAL_TAX_REVIEW comme cible de validation — ce n'est pas une politique validée", () => {
    const result = validateTaxPolicySelection({ policy: "MANUAL_TAX_REVIEW", country: "FR", vatRateBps: 2_000 });
    expect(result).toEqual({ ok: false, reason: "manual_review_is_not_a_validated_policy" });
  });

  it("exige un pays", () => {
    const result = validateTaxPolicySelection({ policy: "FR_B2C", country: null, vatRateBps: 2_000 });
    expect(result).toEqual({ ok: false, reason: "country_required" });
  });

  it("refuse un taux de TVA hors bornes de bon sens", () => {
    expect(validateTaxPolicySelection({ policy: "FR_B2C", country: "FR", vatRateBps: -1 })).toEqual({
      ok: false,
      reason: "vat_rate_out_of_range",
    });
    expect(validateTaxPolicySelection({ policy: "FR_B2C", country: "FR", vatRateBps: 5_000 })).toEqual({
      ok: false,
      reason: "vat_rate_out_of_range",
    });
  });

  it("accepte un taux nul — un export peut légitimement ne porter aucune TVA", () => {
    expect(validateTaxPolicySelection({ policy: "NON_EU_B2C", country: "US", vatRateBps: 0 })).toEqual({ ok: true });
  });

  it("accepte une sélection valide", () => {
    expect(validateTaxPolicySelection({ policy: "FR_B2C", country: "FR", vatRateBps: 2_000 })).toEqual({ ok: true });
  });
});

describe("recomputeProposalTax", () => {
  const base = { customerServicePriceCents: 50_000, shippingTotalCents: 1_500, depositAmountCents: 0 };

  it("ne calcule aucun TTC quand le taux est null", () => {
    const result = recomputeProposalTax(base, null);
    expect(result).toEqual({
      customerTotalHtCents: 51_500,
      customerVatAmountCents: null,
      customerTotalTtcCents: null,
      balanceDueCents: 51_500,
    });
  });

  it("calcule TTC = HT + TVA quand le taux est connu", () => {
    const result = recomputeProposalTax(base, 2_000 /* 20% */);
    expect(result.customerVatAmountCents).toBe(10_300);
    expect(result.customerTotalTtcCents).toBe(61_800);
  });

  it("le solde reste HT-first — jamais calculé sur un TTC (§7)", () => {
    const result = recomputeProposalTax({ ...base, depositAmountCents: 20_000 }, 2_000);
    expect(result.balanceDueCents).toBe(31_500);
  });

  it("le solde ne descend jamais sous zéro", () => {
    const result = recomputeProposalTax({ ...base, depositAmountCents: 999_999 }, null);
    expect(result.balanceDueCents).toBe(0);
  });
});
