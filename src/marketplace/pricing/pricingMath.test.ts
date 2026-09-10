/**
 * La TVA et la marge : les deux calculs qu'on ne veut pas voir diverger d'un
 * écran à l'autre, et qui se font en centimes entiers.
 */
import { describe, expect, it } from "vitest";
import { assessMargin } from "./margin";
import { fromHt, fromTtc, STANDARD_VAT_RATE_BPS, vatOf } from "./vat";
import { POLICY } from "./pricingConsole.fixtures";

describe("TVA", () => {
  it("s'applique au taux normal par défaut, en centimes entiers", () => {
    expect(STANDARD_VAT_RATE_BPS).toBe(2_000);
    expect(fromHt(40_000)).toEqual({
      htCents: 40_000,
      vatRateBps: 2_000,
      vatCents: 8_000,
      ttcCents: 48_000,
    });
  });

  it("arrondit au centime le plus proche, le demi vers le haut", () => {
    // 20 % de 12,34 € = 2,468 € → 2,47 €
    expect(vatOf(1_234)).toBe(247);
    // 20 % de 0,02 € = 0,004 € → 0 ; de 0,03 € = 0,006 € → 0,01 €
    expect(vatOf(2)).toBe(0);
    expect(vatOf(3)).toBe(1);
    // 5,5 % de 0,10 € = 0,0055 € → le demi-centime monte
    expect(vatOf(10, 550)).toBe(1);
  });

  it("retombe exactement sur le TTC donné quand on part du TTC", () => {
    for (const ttc of [1, 99, 12_000, 48_001, 123_457]) {
      const breakdown = fromTtc(ttc);
      expect(breakdown.htCents + breakdown.vatCents).toBe(ttc);
      expect(Number.isInteger(breakdown.htCents)).toBe(true);
    }
  });

  it("refuse les montants non entiers et les taux impossibles", () => {
    expect(() => vatOf(10.5)).toThrow(RangeError);
    expect(() => vatOf(-1)).toThrow(RangeError);
    expect(() => vatOf(100, 10_001)).toThrow(RangeError);
  });
});

describe("marge", () => {
  it("se calcule sur le HT, jamais sur le TTC", () => {
    const margin = assessMargin({ priceHtCents: 40_000, payoutCents: 30_000, ...POLICY });
    expect(margin.marginCents).toBe(10_000);
    expect(margin.marginBps).toBe(2_500);
    expect(margin.status).toBe("OK");
  });

  it("passe en Attention sous la cible", () => {
    const margin = assessMargin({ priceHtCents: 40_000, payoutCents: 34_000, ...POLICY });
    expect(margin.status).toBe("ATTENTION");
    expect(margin.reasons[0]).toContain("sous la cible");
  });

  it("passe en Alerte sous le minimum en euros, même au-dessus de la cible", () => {
    const margin = assessMargin({
      priceHtCents: 10_000,
      payoutCents: 7_000,
      targetMarginBps: 1_800,
      minimumMarginCents: 8_000,
    });
    expect(margin.marginBps).toBe(3_000);
    expect(margin.status).toBe("ALERTE");
  });

  it("passe en Alerte quand la rémunération atteint le prix", () => {
    expect(assessMargin({ priceHtCents: 10_000, payoutCents: 10_000, ...POLICY }).status).toBe(
      "ALERTE",
    );
  });
});
