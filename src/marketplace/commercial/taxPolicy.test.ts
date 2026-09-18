import { describe, expect, it } from "vitest";
import {
  FRANCE_STANDARD_VAT_RATE_BPS,
  isCommercialTaxPolicy,
  recomputeProposalTax,
  resolveAutomaticTaxPolicy,
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

/**
 * Décision opérationnelle temporaire de l'utilisateur (18 septembre
 * 2026, "Décision fiscale temporaire validée") : la seule règle fiscale
 * automatisée à ce jour. Indépendante de `customerType` — un particulier
 * et un professionnel facturés en France reçoivent la même règle (§1-2
 * du brief). Tout le reste (Fine Bindery, UE hors France, hors UE) reste
 * `MANUAL_TAX_REVIEW` : cette fonction ne renvoie rien pour eux, jamais
 * une extrapolation.
 */
describe("resolveAutomaticTaxPolicy", () => {
  it("France : TVA standard 20 % automatique", () => {
    expect(resolveAutomaticTaxPolicy("FR")).toEqual({
      policy: "FR_B2C",
      vatRateBps: FRANCE_STANDARD_VAT_RATE_BPS,
      validationSource: "FR_STANDARD_VAT_20",
    });
    expect(resolveAutomaticTaxPolicy("fr")).toEqual({
      policy: "FR_B2C",
      vatRateBps: 2_000,
      validationSource: "FR_STANDARD_VAT_20",
    });
  });

  it("Fine Bindery UAE : reste MANUAL_TAX_REVIEW — rien d'automatique", () => {
    expect(resolveAutomaticTaxPolicy("AE")).toBeNull();
  });

  it("Fine Bindery USA : reste MANUAL_TAX_REVIEW — rien d'automatique", () => {
    expect(resolveAutomaticTaxPolicy("US")).toBeNull();
  });

  it("EU B2C hors France : reste MANUAL_TAX_REVIEW — pas d'extrapolation à l'UE", () => {
    expect(resolveAutomaticTaxPolicy("DE")).toBeNull();
    expect(resolveAutomaticTaxPolicy("IT")).toBeNull();
  });

  it("pays inconnu ou absent : reste MANUAL_TAX_REVIEW", () => {
    expect(resolveAutomaticTaxPolicy(null)).toBeNull();
    expect(resolveAutomaticTaxPolicy("")).toBeNull();
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

  /**
   * Cas exacts du brief du 18 septembre 2026, §9 : service HT 500 € →
   * TVA 100 € → TTC 600 €, identique pour un particulier (FR B2C) et un
   * professionnel (FR B2B) — la même règle française s'applique aux deux,
   * seul `customer_type` diffère sur la proposition, jamais le calcul.
   */
  it("FR B2C — service HT 500 € → TVA 100 € → TTC 600 €", () => {
    const result = recomputeProposalTax(
      { customerServicePriceCents: 50_000, shippingTotalCents: 0, depositAmountCents: 0 },
      FRANCE_STANDARD_VAT_RATE_BPS,
    );
    expect(result.customerTotalHtCents).toBe(50_000);
    expect(result.customerVatAmountCents).toBe(10_000);
    expect(result.customerTotalTtcCents).toBe(60_000);
  });

  it("FR B2B — service HT 500 € → TVA 100 € → TTC 600 € (même taux qu'un particulier)", () => {
    const result = recomputeProposalTax(
      { customerServicePriceCents: 50_000, shippingTotalCents: 0, depositAmountCents: 0 },
      FRANCE_STANDARD_VAT_RATE_BPS,
    );
    expect(result.customerVatAmountCents).toBe(10_000);
    expect(result.customerTotalTtcCents).toBe(60_000);
  });
});
