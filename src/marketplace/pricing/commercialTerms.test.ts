import { describe, expect, it } from "vitest";
import { resolvePayout, structuralFamily } from "./commercialTerms";

describe("structuralFamily", () => {
  it("finds the one structural work item's family", () => {
    expect(structuralFamily(["demi_cuir", "dorure_titrage"])).toBe("leather");
  });

  it("finds it regardless of position in the list", () => {
    expect(structuralFamily(["dorure_titrage", "nerfs", "pleine_toile"])).toBe("cloth");
  });

  it("returns null when no structural item is identified", () => {
    expect(structuralFamily(["dorure_titrage", "nerfs"])).toBeNull();
  });

  it("returns null for an empty project", () => {
    expect(structuralFamily([])).toBeNull();
  });
});

describe("resolvePayout", () => {
  it("pays exactly the reference amount when no term exists for the family", () => {
    expect(resolvePayout(30_000, null)).toEqual({ payoutCents: 30_000, manualRequired: false });
  });

  it("applies the multiplier when one is configured", () => {
    // Atelier A, cuir : 1,05 (exemple du cahier des charges).
    const result = resolvePayout(30_000, {
      familyKey: "leather",
      payoutMultiplierBps: 10_500,
      manualPayoutRequired: false,
    });
    expect(result).toEqual({ payoutCents: 31_500, manualRequired: false });
  });

  it("a multiplier below 10000 bps reduces the payout", () => {
    const result = resolvePayout(30_000, {
      familyKey: "cloth",
      payoutMultiplierBps: 9_000,
      manualPayoutRequired: false,
    });
    expect(result.payoutCents).toBe(27_000);
  });

  it("manualPayoutRequired wins over any configured multiplier — never auto-computed", () => {
    const result = resolvePayout(30_000, {
      familyKey: "restoration",
      payoutMultiplierBps: 11_500,
      manualPayoutRequired: true,
    });
    expect(result.manualRequired).toBe(true);
    // The reference amount is returned as a placeholder, never the
    // multiplied one — nothing here pretends to have computed a real number.
    expect(result.payoutCents).toBe(30_000);
  });
});
