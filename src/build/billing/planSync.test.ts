import { describe, expect, it } from "vitest";
import { resolvePlanColumnsUpdate } from "./planSync";
import { PLAN_DEFAULTS } from "./plans";

describe("resolvePlanColumnsUpdate", () => {
  it("uses the plan's own defaults when no override is given", () => {
    expect(resolvePlanColumnsUpdate("growth")).toEqual({
      plan: "growth",
      max_active_missions: PLAN_DEFAULTS.growth.maxActiveMissions,
      monthly_brief_quota: PLAN_DEFAULTS.growth.monthlyBriefQuota,
    });
  });

  it("prefers explicit overrides over the plan's defaults", () => {
    expect(
      resolvePlanColumnsUpdate("pro", { max_active_missions: 12, monthly_brief_quota: 2000 }),
    ).toEqual({ plan: "pro", max_active_missions: 12, monthly_brief_quota: 2000 });
  });

  it("falls back to launch-sized numbers for enterprise (null defaults)", () => {
    expect(resolvePlanColumnsUpdate("enterprise")).toEqual({
      plan: "enterprise",
      max_active_missions: 1,
      monthly_brief_quota: 50,
    });
  });
});
