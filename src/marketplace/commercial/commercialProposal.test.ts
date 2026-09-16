import { describe, expect, it } from "vitest";
import { buildCommercialProposalSnapshot, type CommercialProposalSnapshotInput } from "./commercialProposal";

function baseInput(overrides: Partial<CommercialProposalSnapshotInput> = {}): CommercialProposalSnapshotInput {
  return {
    caseId: "11111111-1111-1111-1111-111111111111",
    brand: "MA_RELIURE",
    currency: "EUR",
    pricingMode: "FIXED_PRICE",
    pricingRuleVersion: "bookbinding-2026-09-15-v4",
    pricebookReferenceCents: null,
    pricebookProvenance: null,
    brandMultiplierBps: 10_000,
    brandReferenceCents: null,
    binderPayoutCents: 37_500,
    binderVatRateBps: null,
    targetMarginBps: 2_500,
    minimumContributionCents: 0,
    marginFloorCents: 50_000,
    contributionFloorCents: 37_500,
    priceBoundBy: "margin_floor",
    customerServicePriceCents: 50_000,
    estimateMinCents: null,
    estimateMaxCents: null,
    shipping: { outboundCents: 0, returnCents: 0, otherCents: 0 },
    taxPolicy: "TAX_REVIEW_REQUIRED",
    customerVatRateBps: null,
    deposit: { type: "NONE", valueBps: null, amountCents: 0 },
    ...overrides,
  };
}

describe("buildCommercialProposalSnapshot", () => {
  it("assemble un total HT simple, sans shipping ni acompte", () => {
    const snapshot = buildCommercialProposalSnapshot(baseInput());
    expect(snapshot.customerTotalHtCents).toBe(50_000);
    expect(snapshot.balanceDueCents).toBe(50_000);
    expect(snapshot.customerTotalTtcCents).toBeNull();
    expect(snapshot.status).toBe("draft");
  });

  /**
   * Cas 4 de l'audit du 15 septembre 2026 : le +30% Fine Bindery ne
   * s'applique jamais au shipping — ici, en amont même de la question, le
   * shipping saisi ressort identique quel que soit brandMultiplierBps.
   */
  it("le shipping ressort inchangé, quel que soit le multiplicateur de marque", () => {
    const fineBindery = buildCommercialProposalSnapshot(
      baseInput({
        brand: "FINE_BINDERY",
        brandMultiplierBps: 13_000,
        customerServicePriceCents: 65_000,
        shipping: { outboundCents: 20_000, returnCents: 0, otherCents: 0 },
      }),
    );
    expect(fineBindery.shippingOutboundCents).toBe(20_000);
    expect(fineBindery.shippingTotalCents).toBe(20_000);
    expect(fineBindery.customerTotalHtCents).toBe(85_000); // 650 + 200, jamais 650 + 260
    expect(fineBindery.shippingMarginCents).toBe(0);
    expect(fineBindery.shippingHandlingFeeCents).toBe(0);
  });

  it("calcule la TVA atelier et le payout TTC seulement quand le taux est connu", () => {
    const withVat = buildCommercialProposalSnapshot(
      baseInput({ binderVatRateBps: 2_000 /* 20% */ }),
    );
    expect(withVat.binderVatAmountCents).toBe(7_500);
    expect(withVat.binderPayoutTtcCents).toBe(45_000);

    const withoutVat = buildCommercialProposalSnapshot(baseInput({ binderVatRateBps: null }));
    expect(withoutVat.binderVatAmountCents).toBeNull();
    expect(withoutVat.binderPayoutTtcCents).toBeNull();
  });

  it("calcule le solde après acompte, jamais négatif", () => {
    const snapshot = buildCommercialProposalSnapshot(
      baseInput({ deposit: { type: "PERCENTAGE", valueBps: 2_000, amountCents: 10_000 } }),
    );
    expect(snapshot.balanceDueCents).toBe(40_000);
    expect(snapshot.depositType).toBe("PERCENTAGE");
    expect(snapshot.depositValueBps).toBe(2_000);
  });

  it("ne calcule jamais un TTC client sur un taux non validé", () => {
    const snapshot = buildCommercialProposalSnapshot(baseInput({ customerVatRateBps: null }));
    expect(snapshot.customerVatAmountCents).toBeNull();
    expect(snapshot.customerTotalTtcCents).toBeNull();
  });

  it("calcule le TTC client quand le taux est validé", () => {
    const snapshot = buildCommercialProposalSnapshot(baseInput({ customerVatRateBps: 2_000 }));
    expect(snapshot.customerVatAmountCents).toBe(10_000);
    expect(snapshot.customerTotalTtcCents).toBe(60_000);
  });

  /**
   * Cas 5 et 6 de l'audit du 15 septembre 2026, au niveau applicatif :
   * construire un nouveau snapshot après un changement de politique (marge
   * cible, multiplicateur de marque) ne modifie jamais l'objet déjà rendu
   * pour une version antérieure — chaque appel produit un objet indépendant.
   * L'immuabilité en base (le trigger qui refuse tout UPDATE après
   * `accepted_at`, migration 20260916100000) est la garantie qui compte pour
   * une ligne réellement acceptée ; ce test couvre la partie qu'un test
   * Vitest peut effectivement observer sans base de données.
   */
  it("un nouveau calcul après changement de politique ne touche jamais un snapshot déjà rendu", () => {
    const accepted = buildCommercialProposalSnapshot(
      baseInput({ brand: "FINE_BINDERY", brandMultiplierBps: 13_000, customerServicePriceCents: 65_000 }),
    );
    const acceptedCopy = { ...accepted };

    // Le multiplicateur de marque change ; le Pricebook aussi (référence
    // désormais connue). Un nouveau snapshot est construit pour une AUTRE
    // version — jamais en réécrivant celui déjà accepté.
    buildCommercialProposalSnapshot(
      baseInput({
        brand: "FINE_BINDERY",
        brandMultiplierBps: 13_500,
        pricebookReferenceCents: 55_000,
        customerServicePriceCents: 74_250,
      }),
    );

    expect(accepted).toEqual(acceptedCopy);
    expect(accepted.brandMultiplierBps).toBe(13_000);
    expect(accepted.customerServicePriceCents).toBe(65_000);
  });
});
