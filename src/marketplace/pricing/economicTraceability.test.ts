import { describe, expect, it } from "vitest";
import { applyBrandServicePricing } from "./brandPricing";
import { resolveServicePriceFloors } from "./pricebook";
import { buildCommercialProposalSnapshot } from "@/marketplace/commercial/commercialProposal";

/**
 * Test de traçabilité économique demandé le 16 septembre 2026 : vérifier
 * qu'on peut expliquer a posteriori
 *
 *   Prix Pricebook Ma Reliure → coefficient Fine Bindery → garde-fou marge
 *   → garde-fou contribution → prix client final
 *
 * pour les deux marques à partir des mêmes ingrédients, puis qu'une
 * commande déjà acceptée garde ses chiffres d'origine quand la politique
 * change ensuite.
 *
 * Granularité d'arrondi à 1 € (100 centimes), pas les 10 € de
 * `PRICING_POLICY.roundingIncrementCents` : ce test vérifie la formule avec
 * les chiffres ronds de l'énoncé, pas le comportement d'arrondi de
 * production (déjà couvert par pricebook.test.ts).
 */
describe("traçabilité économique — Pricebook → marque → garde-fous → prix client", () => {
  const ROUNDING = 100; // 1 €

  it("Ma Reliure : la référence Pricebook l'emporte, marge brute 125 €", () => {
    const floors = resolveServicePriceFloors({
      binderPayoutCents: 37_500, // 375 €
      targetMarginBps: 2_500, // 25 %
      minimumContributionCents: 8_000, // 80 €
      roundingIncrementCents: ROUNDING,
      referenceCents: 50_000, // 500 €
    });
    expect(floors.marginFloorCents).toBe(50_000); // 375 / (1 - 25 %)
    expect(floors.contributionFloorCents).toBe(45_500); // 375 + 80
    expect(floors.priceCents).toBe(50_000);

    const brandPrice = applyBrandServicePricing(floors.priceCents, "MA_RELIURE", ROUNDING);
    expect(brandPrice.servicePriceCents).toBe(50_000);
    expect(brandPrice.servicePriceCents - 37_500).toBe(12_500); // marge brute 125 €
  });

  it("Fine Bindery : même Pricebook, ×1,30 appliqué après le MAX, marge brute 275 €", () => {
    const floors = resolveServicePriceFloors({
      binderPayoutCents: 37_500,
      targetMarginBps: 2_500,
      minimumContributionCents: 8_000,
      roundingIncrementCents: ROUNDING,
      referenceCents: 50_000,
    });
    // Le ×1,30 de Fine Bindery s'applique au prix Ma Reliure déjà plafonné
    // (50 000), jamais à la rémunération atelier — brandPricing.ts, inchangé.
    const brandPrice = applyBrandServicePricing(floors.priceCents, "FINE_BINDERY", ROUNDING);
    expect(brandPrice.brandMultiplierBps).toBe(13_000);
    expect(brandPrice.servicePriceCents).toBe(65_000); // 500 € × 1,30
    expect(brandPrice.servicePriceCents - 37_500).toBe(27_500); // marge brute 275 €
  });

  it("une commande déjà acceptée garde 500 €, 80 € et ×1,30 même si la politique change ensuite", () => {
    const acceptedFloors = resolveServicePriceFloors({
      binderPayoutCents: 37_500,
      targetMarginBps: 2_500,
      minimumContributionCents: 8_000,
      roundingIncrementCents: ROUNDING,
      referenceCents: 50_000,
    });
    const acceptedBrandPrice = applyBrandServicePricing(
      acceptedFloors.priceCents,
      "FINE_BINDERY",
      ROUNDING,
    );
    const accepted = buildCommercialProposalSnapshot({
      caseId: "11111111-1111-1111-1111-111111111111",
      brand: "FINE_BINDERY",
      currency: "EUR",
      pricingMode: "FIXED_PRICE",
      pricingRuleVersion: "bookbinding-2026-09-15-v4",
      pricebookReferenceCents: 50_000,
      pricebookProvenance: null,
      brandMultiplierBps: acceptedBrandPrice.brandMultiplierBps,
      brandReferenceCents: acceptedBrandPrice.servicePriceCents,
      binderPayoutCents: 37_500,
      binderVatRateBps: null,
      targetMarginBps: 2_500,
      minimumContributionCents: 8_000,
      marginFloorCents: acceptedFloors.marginFloorCents,
      contributionFloorCents: acceptedFloors.contributionFloorCents,
      priceBoundBy: acceptedFloors.boundBy,
      customerServicePriceCents: acceptedBrandPrice.servicePriceCents,
      estimateMinCents: null,
      estimateMaxCents: null,
      shipping: { outboundCents: 0, returnCents: 0, otherCents: 0 },
      taxPolicy: "MANUAL_TAX_REVIEW",
      customerVatRateBps: null,
      taxCountry: null,
      taxBasis: "service_and_shipping",
      taxValidationSource: null,
      taxValidatedAt: null,
      taxValidatedBy: null,
      customerType: "CUSTOMER",
      businessName: null,
      businessVatNumber: null,
      businessVatValidationStatus: null,
      billingCountry: null,
      deposit: { type: "NONE", valueBps: null, amountCents: 0 },
      status: "accepted",
    });

    // La politique change : référence Pricebook 500 € → 550 €, contribution
    // minimale 80 € → 100 € (le multiplicateur de marque, lui, est fixé par
    // MARKETPLACE_BRAND_CONFIGS — voir brandPricing.test.ts pour sa propre
    // non-régression — donc simulé ici comme un nouveau candidat de prix
    // plutôt que rejoué via applyBrandServicePricing).
    const revisedFloors = resolveServicePriceFloors({
      binderPayoutCents: 37_500,
      targetMarginBps: 2_500,
      minimumContributionCents: 10_000,
      roundingIncrementCents: ROUNDING,
      referenceCents: 55_000,
    });

    // La nouvelle politique produit bien un prix de référence différent...
    expect(revisedFloors.referenceCents).toBe(55_000);
    expect(revisedFloors.priceCents).toBe(55_000);
    expect(revisedFloors.contributionFloorCents).toBe(47_500); // 375 + 100

    // ...mais la proposition déjà acceptée n'a pas bougé d'un centime : ni
    // la référence Pricebook, ni la contribution minimale, ni le
    // multiplicateur, ni le prix contractuel gelés au moment de l'offre.
    expect(accepted.pricebookReferenceCents).toBe(50_000);
    expect(accepted.minimumContributionCents).toBe(8_000);
    expect(accepted.brandMultiplierBps).toBe(13_000);
    expect(accepted.customerServicePriceCents).toBe(65_000);
  });
});
