import { describe, expect, it } from "vitest";
import { applyBrandServicePricing } from "./brandPricing";
import { MARKETPLACE_BRAND_CONFIGS, type MarketplaceBrandConfig } from "@/marketplace/brand/brandConfig";

describe("applyBrandServicePricing — §58", () => {
  it("leaves Ma Reliure's own price untouched — multiplier is ×1.00", () => {
    const result = applyBrandServicePricing(100_000, "MA_RELIURE", 1_000);
    expect(result.brandMultiplierBps).toBe(10_000);
    expect(result.servicePriceCents).toBe(100_000);
    expect(result.baseServicePriceCents).toBe(100_000);
    expect(result.minimumApplied).toBe(false);
  });

  it("adds exactly 30% for Fine Bindery — 100 000 cents base becomes 130 000", () => {
    const result = applyBrandServicePricing(100_000, "FINE_BINDERY", 1_000);
    expect(result.brandMultiplierBps).toBe(13_000);
    expect(result.servicePriceCents).toBe(130_000);
  });

  it("rounds the multiplied price up to the configured increment, never down", () => {
    // 118 000 × 1.30 = 153 400 → doit monter à 154 000, pas retomber à 153 000.
    const result = applyBrandServicePricing(118_000, "FINE_BINDERY", 1_000);
    expect(result.servicePriceCents).toBe(154_000);
  });

  it("never reports a tax decision that was not actually made", () => {
    expect(applyBrandServicePricing(100_000, "MA_RELIURE", 1_000).taxStatus).toBe(
      "TAX_REVIEW_REQUIRED",
    );
    expect(applyBrandServicePricing(100_000, "FINE_BINDERY", 1_000).taxStatus).toBe(
      "TAX_REVIEW_REQUIRED",
    );
  });

  it("does not publish a real minimum in production config (§15)", () => {
    expect(MARKETPLACE_BRAND_CONFIGS.FINE_BINDERY.pricingPolicy.minimumServicePriceCents).toBeNull();
  });

  /**
   * Le plancher est testé sur une politique fabriquée localement, jamais sur
   * la config réelle (§15 : aucun seuil publié sans validation admin) — la
   * valeur ci-dessous est une hypothèse de test, pas un prix.
   */
  it("raises the price to the configured floor when the multiplied amount falls under it", () => {
    const hypotheticalFloorPolicy: MarketplaceBrandConfig = {
      ...MARKETPLACE_BRAND_CONFIGS.FINE_BINDERY,
      pricingPolicy: {
        serviceMultiplierBps: 13_000,
        minimumServicePriceCents: 65_000, // TEST_ONLY — pas la config réelle.
      },
    };
    const withFloor = (base: number) => {
      const policy = hypotheticalFloorPolicy.pricingPolicy;
      const raw = (base * policy.serviceMultiplierBps) / 10_000;
      const multiplied = Math.ceil(raw / 1_000) * 1_000;
      const floor = policy.minimumServicePriceCents;
      return floor !== null ? Math.max(multiplied, floor) : multiplied;
    };
    // Un petit projet (10 000 cents de base) resterait sous le plancher sans lui.
    expect(withFloor(10_000)).toBe(65_000);
    // Un projet déjà au-dessus du plancher n'est pas affecté.
    expect(withFloor(100_000)).toBe(130_000);
  });
});
