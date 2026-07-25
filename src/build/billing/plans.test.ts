import { describe, expect, it } from "vitest";
import { PLAN_DEFAULTS, getPlanDefaults, isPlanId } from "./plans";

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
});
