import { describe, expect, it } from "vitest";
import { buildCheckoutLineItems, checkoutEligibility } from "./checkoutPlan";

const PRODUCT_IDS = {
  maReliureService: "prod_ma_reliure",
  fineBinderyService: "prod_fine_bindery",
  shipping: "prod_shipping",
};

describe("checkoutEligibility", () => {
  const base = { status: "accepted", acceptedAt: "2026-09-16T00:00:00.000Z", taxPolicy: "TAX_REVIEW_REQUIRED", alreadyPaid: false };

  it("bloque tant que tax_policy reste TAX_REVIEW_REQUIRED — fail closed par défaut", () => {
    expect(checkoutEligibility(base)).toEqual({ eligible: false, reason: "tax_review_required" });
  });

  it("bloque une proposition non acceptée, même avec une politique fiscale résolue", () => {
    const result = checkoutEligibility({ ...base, status: "proposed", acceptedAt: null, taxPolicy: "FR_STANDARD" });
    expect(result).toEqual({ eligible: false, reason: "proposal_not_accepted" });
  });

  it("bloque un second Checkout si la proposition est déjà payée", () => {
    const result = checkoutEligibility({ ...base, taxPolicy: "FR_STANDARD", alreadyPaid: true });
    expect(result).toEqual({ eligible: false, reason: "already_paid" });
  });

  it("autorise seulement quand acceptée ET la fiscalité est résolue ET pas déjà payée", () => {
    const result = checkoutEligibility({ ...base, taxPolicy: "FR_STANDARD" });
    expect(result).toEqual({ eligible: true });
  });
});

describe("buildCheckoutLineItems", () => {
  it("une seule ligne (service) quand il n'y a pas de transport", () => {
    const lines = buildCheckoutLineItems(
      { brand: "MA_RELIURE", currency: "EUR", customerServicePriceCents: 50_000, shippingTotalCents: 0 },
      PRODUCT_IDS,
    );
    expect(lines).toEqual([
      { productId: "prod_ma_reliure", unitAmountCents: 50_000, currency: "eur", quantity: 1 },
    ]);
  });

  it("ajoute la ligne transport seulement si elle est non nulle", () => {
    const lines = buildCheckoutLineItems(
      { brand: "MA_RELIURE", currency: "EUR", customerServicePriceCents: 50_000, shippingTotalCents: 1_500 },
      PRODUCT_IDS,
    );
    expect(lines).toHaveLength(2);
    expect(lines[1]).toEqual({ productId: "prod_shipping", unitAmountCents: 1_500, currency: "eur", quantity: 1 });
  });

  it("Fine Bindery pointe vers son propre Product, jamais celui de Ma Reliure", () => {
    const lines = buildCheckoutLineItems(
      { brand: "FINE_BINDERY", currency: "EUR", customerServicePriceCents: 65_000, shippingTotalCents: 0 },
      PRODUCT_IDS,
    );
    expect(lines[0].productId).toBe("prod_fine_bindery");
    // Le module ne connaît aucun coefficient : 65 000 est déjà le résultat final (§11).
    expect(lines[0].unitAmountCents).toBe(65_000);
  });
});
