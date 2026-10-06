import { describe, expect, it } from "vitest";
import { resolveAmountDue } from "@/marketplace/stripe/amountDue";
import { SERVICE_TAX_CATEGORIES, SHIPPING_SUGGESTION, TAX_MATRIX, TAX_QUESTIONS_FOR_ACCOUNTANT, computeLineTax, isServiceTaxCategory } from "./taxMatrix";

describe("matrice fiscale (suggestions à valider)", () => {
  it("ne contient que des suggestions sourcées, jamais un taux imposé", () => {
    expect(SERVICE_TAX_CATEGORIES).toHaveLength(3);
    for (const key of SERVICE_TAX_CATEGORIES) {
      expect(TAX_MATRIX[key].source).toMatch(/BOI-TVA-LIQ-30-10-40/);
      expect(TAX_MATRIX[key].caveat.length).toBeGreaterThan(20);
    }
    expect(TAX_MATRIX.book_binding.suggestedRateBps).toBe(550);
    expect(TAX_MATRIX.book_repair_restoration.suggestedRateBps).toBe(2000);
    expect(SHIPPING_SUGGESTION.caveat).toMatch(/reste à qualifier/);
    expect(TAX_QUESTIONS_FOR_ACCOUNTANT.length).toBeGreaterThanOrEqual(6);
    expect(isServiceTaxCategory("book_binding")).toBe(true);
    expect(isServiceTaxCategory("n'importe quoi")).toBe(false);
  });
});

describe("TVA ligne par ligne", () => {
  it("5,5 % sur la prestation et 20 % sur le forfait de transport", () => {
    expect(computeLineTax({ serviceCents: 20000, shippingCents: 1250, serviceRateBps: 550, shippingRateBps: 2000 })).toEqual({
      serviceVatCents: 1100, shippingVatCents: 250, vatCents: 1350, totalHtCents: 21250, totalTtcCents: 22600,
    });
  });
  it("arrondit chaque ligne seule, au centime", () => {
    const r = computeLineTax({ serviceCents: 33333, shippingCents: 0, serviceRateBps: 550, shippingRateBps: null });
    expect(r.serviceVatCents).toBe(1833);
    expect(r.totalTtcCents).toBe(35166);
  });
  it("sans ligne de transport, aucun taux de transport n'est exigé", () => {
    expect(computeLineTax({ serviceCents: 10000, shippingCents: 0, serviceRateBps: 2000, shippingRateBps: null }).vatCents).toBe(2000);
  });
});

describe("montant exigible d'un devis à taux par ligne", () => {
  const base = { currency: "eur", customerServicePriceCents: 20000, shippingTotalCents: 1250, customerTotalHtCents: 21250, depositType: "NONE", depositAmountCents: 0 };
  it("accepte un devis dont la TVA est la somme des deux lignes", () => {
    const r = resolveAmountDue({ ...base, customerVatRateBps: 550, shippingVatRateBps: 2000, customerVatAmountCents: 1350, customerTotalTtcCents: 22600 });
    expect(r).toMatchObject({ ok: true, amountCents: 22600, vatCents: 1350, serviceLineCents: 21100, shippingLineCents: 1500 });
  });
  it("refuse un devis dont la TVA a été calculée sur un taux unique", () => {
    const r = resolveAmountDue({ ...base, customerVatRateBps: 550, shippingVatRateBps: 2000, customerVatAmountCents: 1169, customerTotalTtcCents: 22419 });
    expect(r).toEqual({ ok: false, reason: "amount_inconsistent", detail: "vat_amount" });
  });
  it("conserve le calcul historique à taux unique", () => {
    const r = resolveAmountDue({ ...base, customerVatRateBps: 2000, customerVatAmountCents: 4250, customerTotalTtcCents: 25500 });
    expect(r).toMatchObject({ ok: true, amountCents: 25500, serviceLineCents: 24000, shippingLineCents: 1500 });
  });
});
