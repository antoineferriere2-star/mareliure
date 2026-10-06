import { describe, expect, it } from "vitest";
import { administrativeRateApproval, ADMINISTRATIVE_TAX_APPROVAL } from "./administrativeTaxApproval";

describe("portée de l'approbation administrative des taux", () => {
  it.each([
    ["book_binding", 550],
    ["book_repair_restoration", 2000],
    ["non_book_object", 2000],
  ] as const)("reconnaît le taux configuré de %s et le transport distinct", (category, serviceRateBps) => {
    expect(administrativeRateApproval({ category, serviceRateBps, shippingCents: 1250, shippingRateBps: 2000 }))
      .toMatchObject({ approved_on: "2026-10-06", service_rate_approved: true, shipping_rate_approved: true,
        accountant_validated: false, legally_validated: false });
  });
  it("ne couvre ni une dérogation de taux ni un transport sans taux", () => {
    expect(administrativeRateApproval({ category: "book_binding", serviceRateBps: 2000, shippingCents: 1250, shippingRateBps: null }))
      .toMatchObject({ service_rate_approved: false, shipping_rate_approved: false });
  });
  it("n'invente aucun taux pour B/C et ne crée pas de ligne de transport", () => {
    expect(ADMINISTRATIVE_TAX_APPROVAL.subscriptionVatRateBps).toBeNull();
    expect(ADMINISTRATIVE_TAX_APPROVAL.platformFeeVatRateBps).toBeNull();
    expect(administrativeRateApproval({ category: "book_binding", serviceRateBps: 550, shippingCents: 0, shippingRateBps: null }))
      .toMatchObject({ shipping_rate_approved: null });
  });
});
