import { describe, expect, it } from "vitest";
import {
  PLAN_DEFAULTS,
  formatMonthlyUsdPrice,
  getPlanByStripeLookupKey,
  getPlanDefaults,
  isPlanId,
} from "./plans";

describe("plans", () => {
  it("has numeric defaults for every plan except enterprise", () => {
    for (const [id, defaults] of Object.entries(PLAN_DEFAULTS)) {
      if (id === "enterprise") {
        expect(defaults.maxActiveMissions).toBeNull();
        expect(defaults.monthlyBriefQuota).toBeNull();
      } else {
        expect(defaults.maxActiveMissions).toBeGreaterThan(0);
        expect(defaults.monthlyBriefQuota).toBeGreaterThan(0);
      }
    }
  });

  it("increases active-Mission and Brief limits as plans go up", () => {
    const order = ["launch", "growth", "pro", "business"] as const;
    for (let i = 1; i < order.length; i++) {
      const prev = PLAN_DEFAULTS[order[i - 1]];
      const curr = PLAN_DEFAULTS[order[i]];
      expect(curr.maxActiveMissions!).toBeGreaterThan(prev.maxActiveMissions!);
      expect(curr.monthlyBriefQuota!).toBeGreaterThan(prev.monthlyBriefQuota!);
    }
  });

  it("recognizes valid plan ids", () => {
    expect(isPlanId("growth")).toBe(true);
    expect(isPlanId("nonsense")).toBe(false);
  });

  it("falls back to launch defaults for an unknown plan string", () => {
    expect(getPlanDefaults("nonsense")).toEqual(PLAN_DEFAULTS.launch);
  });

  it("returns the matching plan's defaults", () => {
    expect(getPlanDefaults("pro")).toEqual(PLAN_DEFAULTS.pro);
  });

  it("maps a Stripe Price lookup_key back to its plan id", () => {
    expect(getPlanByStripeLookupKey("growth_monthly")).toBe("growth");
    expect(getPlanByStripeLookupKey("unknown_lookup_key")).toBeNull();
  });

  it("has no Stripe lookup_key for enterprise (negotiated, no self-serve price)", () => {
    expect(PLAN_DEFAULTS.enterprise.stripeLookupKey).toBeNull();
  });

  it("stores the LOT5 self-serve Stripe price catalog next to lookup keys and quotas", () => {
    expect(PLAN_DEFAULTS.launch).toMatchObject({
      maxActiveMissions: 1,
      monthlyBriefQuota: 50,
      stripeLookupKey: "launch_monthly",
      monthlyUsdPrice: { currency: "USD", amountCents: 1999 },
    });
    expect(PLAN_DEFAULTS.growth).toMatchObject({
      maxActiveMissions: 3,
      monthlyBriefQuota: 250,
      stripeLookupKey: "growth_monthly",
      monthlyUsdPrice: { currency: "USD", amountCents: 5900 },
    });
    expect(PLAN_DEFAULTS.pro).toMatchObject({
      maxActiveMissions: 8,
      monthlyBriefQuota: 1000,
      stripeLookupKey: "pro_monthly",
      monthlyUsdPrice: { currency: "USD", amountCents: 14900 },
    });
    expect(PLAN_DEFAULTS.business).toMatchObject({
      maxActiveMissions: 20,
      monthlyBriefQuota: 5000,
      stripeLookupKey: "business_monthly",
      monthlyUsdPrice: { currency: "USD", amountCents: 29900 },
    });
    expect(PLAN_DEFAULTS.enterprise.monthlyUsdPrice).toBeNull();
  });

  it("formats monthly USD prices for the portal without component-level constants", () => {
    expect(formatMonthlyUsdPrice(PLAN_DEFAULTS.launch.monthlyUsdPrice)).toBe("19,99 $/mois");
    expect(formatMonthlyUsdPrice(PLAN_DEFAULTS.growth.monthlyUsdPrice)).toBe("59 $/mois");
    expect(formatMonthlyUsdPrice(PLAN_DEFAULTS.pro.monthlyUsdPrice)).toBe("149 $/mois");
    expect(formatMonthlyUsdPrice(PLAN_DEFAULTS.business.monthlyUsdPrice)).toBe("299 $/mois");
    expect(formatMonthlyUsdPrice(PLAN_DEFAULTS.enterprise.monthlyUsdPrice)).toBe("Sur devis");
  });
});
