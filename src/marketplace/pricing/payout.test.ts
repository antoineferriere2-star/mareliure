/**
 * La rémunération des ateliers se calcule depuis le prix Ma Reliure, par une
 * politique administrable. Aucune grille d'atelier n'y entre.
 */
import { describe, expect, it } from "vitest";
import { proposeBinderPayout, validatePayoutPolicy } from "./payout";
import { POLICY } from "./pricingGrid.fixtures";

describe("rémunération proposée à l'atelier", () => {
  it("400 € HT, marge cible 25 %, minimum 80 € : 300 € pour l'atelier", () => {
    expect(proposeBinderPayout(40_000, POLICY)).toEqual({
      payoutCents: 30_000,
      retainedMarginCents: 10_000,
      problem: null,
    });
  });

  it("la marge minimale en euros l'emporte sur un petit projet", () => {
    // 25 % de 200 € = 50 €, sous le minimum de 80 € : l'atelier reçoit 120 €.
    expect(proposeBinderPayout(20_000, POLICY).payoutCents).toBe(12_000);
  });

  it("arrondit à l'euro inférieur, pour que la marge ne passe jamais sous la règle", () => {
    const proposal = proposeBinderPayout(36_667, POLICY);
    expect(proposal.payoutCents).toBe(27_500);
    expect(proposal.retainedMarginCents).toBeGreaterThanOrEqual(Math.ceil(36_667 / 4));
  });

  it("suit la politique quand Ma Reliure la change", () => {
    expect(
      proposeBinderPayout(40_000, { targetMarginBps: 3_000, minimumMarginCents: 8_000 })
        .payoutCents,
    ).toBe(28_000);
  });

  it("ne propose rien quand le prix ne couvre pas la marge minimale", () => {
    const proposal = proposeBinderPayout(7_000, POLICY);
    expect(proposal.payoutCents).toBeNull();
    expect(proposal.problem).toContain("marge minimale");
  });

  it("refuse une politique incohérente", () => {
    expect(validatePayoutPolicy(POLICY)).toEqual([]);
    expect(validatePayoutPolicy({ targetMarginBps: 9_500, minimumMarginCents: 0 })).toHaveLength(1);
    expect(validatePayoutPolicy({ targetMarginBps: 2_500, minimumMarginCents: -1 })).toHaveLength(
      1,
    );
  });
});
