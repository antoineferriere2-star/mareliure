import { describe, expect, it } from "vitest";
import { DEFAULT_COMMISSION_BPS } from "@/marketplace/config";
import { commissionBps, formatEuros, splitAmount } from "./commission";

describe("the split between the platform and the artisan", () => {
  it("takes 15 % by default", () => {
    // §72's arithmetic: a 340 € order leaves 51 € of commission.
    expect(splitAmount(34_000)).toEqual({
      grossCents: 34_000,
      commissionBps: DEFAULT_COMMISSION_BPS,
      commissionCents: 5_100,
      binderCents: 28_900,
    });
  });

  it("always adds back up to the gross, whatever the rounding", () => {
    for (let cents = 1_000; cents <= 200_000; cents += 137) {
      const split = splitAmount(cents);
      expect(split.commissionCents + split.binderCents).toBe(cents);
    }
  });

  it("honours a negotiated rate", () => {
    expect(splitAmount(10_000, 1_000).commissionCents).toBe(1_000);
    expect(splitAmount(10_000, 0).commissionCents).toBe(0);
  });

  it("refuses a rate that is not a whole number of basis points, or out of range", () => {
    expect(() => commissionBps(15.5)).toThrow();
    expect(() => commissionBps(-1)).toThrow();
    expect(() => commissionBps(10_001)).toThrow();
  });

  it("refuses amounts that are not positive whole cents", () => {
    // A float here is how a payout ends up a cent short of what an artisan
    // was promised.
    expect(() => splitAmount(0)).toThrow();
    expect(() => splitAmount(-100)).toThrow();
    expect(() => splitAmount(340.5)).toThrow();
  });

  it("formats in euros the way a French invoice does", () => {
    // The separators are locale-dependent non-breaking spaces; compare on the
    // digits and the symbol rather than on invisible characters.
    const formatted = formatEuros(34_000);
    expect(formatted).toContain("340");
    expect(formatted).toContain("€");
  });
});
