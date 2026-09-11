import { describe, expect, it } from "vitest";
import { depositCentsFor, pricingModeFor } from "./pricingMode";

describe("pricingModeFor", () => {
  it("a manual_review suggestion is always MANUAL_STUDY", () => {
    expect(pricingModeFor({ status: "manual_review", confidence: "manual_review" })).toBe(
      "MANUAL_STUDY",
    );
  });

  it("a high-confidence suggestion is a firm price", () => {
    expect(pricingModeFor({ status: "suggested", confidence: "high" })).toBe("FIXED_PRICE");
  });

  it("medium confidence is an estimate to confirm, not a firm price", () => {
    expect(pricingModeFor({ status: "suggested", confidence: "medium" })).toBe(
      "ESTIMATE_THEN_CONFIRM",
    );
  });

  it("low confidence is also an estimate to confirm", () => {
    expect(pricingModeFor({ status: "suggested", confidence: "low" })).toBe(
      "ESTIMATE_THEN_CONFIRM",
    );
  });
});

describe("depositCentsFor", () => {
  const policy = { depositPercentageBps: 2_000, depositMinimumCents: 5_000 };

  it("uses the percentage when it exceeds the floor", () => {
    // 20% of 50 000 = 10 000, above the 5 000 floor.
    expect(depositCentsFor(50_000, policy)).toBe(10_000);
  });

  it("uses the floor when the percentage would be lower", () => {
    // 20% of 10 000 = 2 000, below the 5 000 floor.
    expect(depositCentsFor(10_000, policy)).toBe(5_000);
  });

  it("never returns a hardcoded 100 € regardless of policy", () => {
    const generousPolicy = { depositPercentageBps: 3_000, depositMinimumCents: 8_000 };
    expect(depositCentsFor(100_000, generousPolicy)).toBe(30_000);
    expect(depositCentsFor(100_000, policy)).not.toBe(depositCentsFor(100_000, generousPolicy));
  });
});
