import { describe, expect, it } from "vitest";
import { shippingTaxQualificationError } from "./shippingTaxQualification";
describe("qualification transport avant TVA", () => {
  const input = { shippingCents: 1000, country: "FR", serviceRateBps: 550, shippingRateBps: 550 };
  it("ne déduit pas un taux d'une facturation distincte", () => {
    expect(shippingTaxQualificationError({ ...input, nature: null })).toContain("Qualifiez");
  });
  it("applique le taux principal à l'accessoire et le taux normal à l'autonome", () => {
    expect(shippingTaxQualificationError({ ...input, nature: "accessory" })).toBeNull();
    expect(shippingTaxQualificationError({ ...input, nature: "autonomous" })).toContain("20 %");
    expect(shippingTaxQualificationError({ ...input, nature: "autonomous", shippingRateBps: 2000 })).toBeNull();
    expect(shippingTaxQualificationError({ ...input, nature: "accessory", shippingRateBps: 2000 })).toContain("principal");
  });
  it("laisse une qualification ambiguë à une décision individuelle, sans préremplir un taux", () => {
    expect(shippingTaxQualificationError({ ...input, nature: "manual_review", shippingRateBps: null })).toContain("justifiez");
    expect(shippingTaxQualificationError({ ...input, nature: "manual_review" })).toBeNull();
    expect(shippingTaxQualificationError({ ...input, nature: null, shippingCents: 0, shippingRateBps: null })).toBeNull();
  });
});
