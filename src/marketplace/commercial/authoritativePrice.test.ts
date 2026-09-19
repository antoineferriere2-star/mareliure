/**
 * Phase 0 / P1-4 — une seule autorité de prix : `customer_price_cents` d'un dossier dont le prix est
 * validé. La suggestion initiale du moteur reste une trace, jamais une seconde vérité.
 */
import { describe, expect, it } from "vitest";
import { authoritativeServicePrice, proposalCarriesCurrentPrice, type CasePriceFacts } from "./authoritativePrice";

const facts = (over: Partial<CasePriceFacts> = {}): CasePriceFacts => ({
  pricingStatus: "validated",
  customerPriceCents: 45_000,
  binderPayoutCents: 30_000,
  suggestedCustomerPriceCents: 50_000,
  ...over,
});

describe("authoritativeServicePrice", () => {
  it("le scénario audité : le moteur suggère 500 €, l'admin corrige et valide 450 € → la proposition prend 450 €", () => {
    expect(authoritativeServicePrice(facts())).toEqual({
      ok: true,
      priceCents: 45_000, // le prix validé, PAS les 500 € de la suggestion (service_price_cents)
      binderPayoutCents: 30_000,
      suggestedPriceCents: 50_000, // la trace de la suggestion initiale
      correctedByHuman: true,
    });
  });

  it("un prix validé tel que suggéré n'est pas une correction", () => {
    expect(authoritativeServicePrice(facts({ customerPriceCents: 50_000 }))).toMatchObject({ ok: true, priceCents: 50_000, correctedByHuman: false });
  });

  it("un prix saisi sans suggestion (dossier chiffré à la main) est valide, sans correction", () => {
    expect(authoritativeServicePrice(facts({ suggestedCustomerPriceCents: null }))).toMatchObject({
      ok: true,
      suggestedPriceCents: null,
      correctedByHuman: false,
    });
  });

  it.each([
    ["suggéré, jamais validé", { pricingStatus: "suggested" }],
    ["à revoir à la main", { pricingStatus: "manual_review" }],
    ["statut absent", { pricingStatus: null }],
  ] as [string, Partial<CasePriceFacts>][])("refuse un prix %s", (_label, over) => {
    expect(authoritativeServicePrice(facts(over))).toEqual({ ok: false, reason: "price_not_validated" });
  });

  it.each([
    ["prix client absent", { customerPriceCents: null }],
    ["prix client nul", { customerPriceCents: 0 }],
    ["prix client négatif", { customerPriceCents: -100 }],
    ["prix client fractionnaire", { customerPriceCents: 450.5 }],
    ["rémunération atelier absente", { binderPayoutCents: null }],
  ] as [string, Partial<CasePriceFacts>][])("refuse : %s", (_label, over) => {
    expect(authoritativeServicePrice(facts(over))).toEqual({ ok: false, reason: "price_missing" });
  });
});

describe("proposalCarriesCurrentPrice", () => {
  it("une proposition au prix validé courant est à jour", () => {
    expect(proposalCarriesCurrentPrice(45_000, { pricingStatus: "validated", customerPriceCents: 45_000 })).toBe(true);
  });
  it("un prix re-validé depuis sa création la périme", () => {
    expect(proposalCarriesCurrentPrice(50_000, { pricingStatus: "validated", customerPriceCents: 45_000 })).toBe(false);
  });
  it("un prix qui n'est plus validé la périme aussi", () => {
    expect(proposalCarriesCurrentPrice(45_000, { pricingStatus: "suggested", customerPriceCents: 45_000 })).toBe(false);
  });
  it("aucun prix courant : jamais à jour", () => {
    expect(proposalCarriesCurrentPrice(45_000, { pricingStatus: "validated", customerPriceCents: null })).toBe(false);
  });
});
