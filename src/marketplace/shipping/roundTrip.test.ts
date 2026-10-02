import { describe, expect, it } from "vitest";
import { evaluateRoundTrip, roundTripBaseForValidatedVat } from "./roundTrip";

const ordinary = { weightGrams: 420, lengthMm: 300, widthMm: 210, heightMm: 60 };
const candidate = {
  customerCountry: "FR", customerPostalCode: "75011", workshopCountry: "FR",
  workshopPostalCode: "24160", customerAddressVerified: true, workshopAddressVerified: true,
  workshopAgreedToReceive: true, heritageOrIrreplaceable: false, declaredValueBand: "under_100",
  outboundParcel: ordinary, returnParcel: ordinary, now: "2026-10-01T10:00:00Z",
  quote: { outboundTtcCents: 600, returnTtcCents: 650, labelFeesTtcCents: 40,
    packagingTtcCents: 50, otherKnownCostsTtcCents: 30,
    estimatedEconomicCostCents: 1142, economicCostReference: "QA accounting review only",
    methodReference: "RECETTE-ONLY",
    validUntil: "2026-10-02T10:00:00Z", bothDirectionsAvailable: true,
    customerAsSenderPermitted: true, entrustedBookConditionsReviewed: true },
};

describe("round-trip 15 EUR TTC gate", () => {
  it("requires separate cash and after-tax cost evidence", () =>
    expect(evaluateRoundTrip(candidate)).toEqual({ eligible: true, customerTtcCents: 1500,
      estimatedCostTtcCents: 1370, cashSpreadTtcCents: 130,
      estimatedEconomicCostCents: 1142, estimatedNetMarginCents: 108 }));
  it.each([
    [{ quote: null }, "cost_unconfirmed"],
    [{ quote: { ...candidate.quote, returnTtcCents: 1200 } }, "cost_exceeds_price"],
    [{ quote: { ...candidate.quote, estimatedEconomicCostCents: null } }, "economic_cost_unconfirmed"],
    [{ quote: { ...candidate.quote, estimatedEconomicCostCents: 1300 } }, "economic_cost_exceeds_revenue"],
    [{ workshopAgreedToReceive: false }, "address_review"],
    [{ customerPostalCode: "97100" }, "outside_mainland"],
    [{ customerPostalCode: "20000" }, "outside_mainland"],
    [{ returnParcel: { ...ordinary, weightGrams: 501 } }, "parcel_review"],
    [{ heritageOrIrreplaceable: true }, "valuable_book"],
    [{ declaredValueBand: "unknown" }, "valuable_book"],
    [{ quote: { ...candidate.quote, customerAsSenderPermitted: false } }, "method_unconfirmed"],
    [{ quote: { ...candidate.quote, validUntil: "2026-09-30T10:00:00Z" } }, "method_unconfirmed"],
  ] as const)("blocks unsupported or unverified conditions %#", (change, reason) =>
    expect(evaluateRoundTrip({ ...candidate, ...change })).toMatchObject({ eligible: false, reason }));
  it("derives the 15 EUR TTC line only under a validated rate", () => {
    expect(roundTripBaseForValidatedVat(0)).toBe(1500);
    expect(roundTripBaseForValidatedVat(2000)).toBe(1250);
    expect(roundTripBaseForValidatedVat(-1)).toBeNull();
  });
});
