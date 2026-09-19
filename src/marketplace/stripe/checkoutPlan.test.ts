import { describe, expect, it } from "vitest";
import {
  buildCheckoutLineItems,
  checkoutEligibility,
  statementDescriptorSuffixForBrand,
} from "./checkoutPlan";
import { resolveAmountDue } from "./amountDue";
import { amountInput } from "./amountDue.fixtures";

const PRODUCT_IDS = {
  maReliureService: "prod_ma_reliure",
  fineBinderyService: "prod_fine_bindery",
  shipping: "prod_shipping",
};

describe("checkoutEligibility", () => {
  const base = {
    status: "accepted",
    acceptedAt: "2026-09-16T00:00:00.000Z",
    taxPolicy: "MANUAL_TAX_REVIEW",
    taxValidatedAt: null,
    customerType: "CUSTOMER",
    businessName: null,
    alreadyPaid: false,
    amount: amountInput(50_000, 0, 2000),
  };

  it("bloque tant que tax_policy reste MANUAL_TAX_REVIEW — fail closed par défaut", () => {
    expect(checkoutEligibility(base)).toEqual({ eligible: false, reason: "tax_review_required" });
  });

  it("bloque même une catégorie fiscale nommée si elle n'a pas été validée (tax_validated_at manquant)", () => {
    const result = checkoutEligibility({ ...base, taxPolicy: "FR_B2C", taxValidatedAt: null });
    expect(result).toEqual({ eligible: false, reason: "tax_review_required" });
  });

  it("bloque une proposition non acceptée, même avec une politique fiscale résolue", () => {
    const result = checkoutEligibility({
      ...base,
      status: "proposed",
      acceptedAt: null,
      taxPolicy: "FR_B2C",
      taxValidatedAt: "2026-09-17T00:00:00.000Z",
    });
    expect(result).toEqual({ eligible: false, reason: "proposal_not_accepted" });
  });

  it("bloque un second Checkout si la proposition est déjà payée", () => {
    const result = checkoutEligibility({
      ...base,
      taxPolicy: "FR_B2C",
      taxValidatedAt: "2026-09-17T00:00:00.000Z",
      alreadyPaid: true,
    });
    expect(result).toEqual({ eligible: false, reason: "already_paid" });
  });

  it("autorise seulement quand acceptée ET la fiscalité est validée ET pas déjà payée", () => {
    const result = checkoutEligibility({
      ...base,
      taxPolicy: "FR_B2C",
      taxValidatedAt: "2026-09-17T00:00:00.000Z",
    });
    expect(result).toMatchObject({ eligible: true });
  });

  /**
   * §10, §15 du brief du 17 septembre 2026 : le modèle ne doit jamais
   * présumer qu'un client est un particulier — Fine Bindery recevra des
   * antiquaires, libraires, hôtels, sociétés.
   */
  it("bloque un client BUSINESS sans raison sociale, même fiscalité validée", () => {
    const result = checkoutEligibility({
      ...base,
      taxPolicy: "FR_B2C",
      taxValidatedAt: "2026-09-17T00:00:00.000Z",
      customerType: "BUSINESS",
      businessName: null,
    });
    expect(result).toEqual({ eligible: false, reason: "business_identity_incomplete" });
  });

  it("autorise un client BUSINESS dont la raison sociale est renseignée", () => {
    const result = checkoutEligibility({
      ...base,
      taxPolicy: "FR_B2C",
      taxValidatedAt: "2026-09-17T00:00:00.000Z",
      customerType: "BUSINESS",
      businessName: "Librairie Ancienne SARL",
    });
    expect(result).toMatchObject({ eligible: true });
  });
});

const due = (service: number, shipping: number) => {
  const r = resolveAmountDue(amountInput(service, shipping, 2000));
  if (!r.ok) throw new Error("expected a resolved amount");
  return r;
};

describe("buildCheckoutLineItems", () => {
  it("une seule ligne (service, TTC) quand il n'y a pas de transport", () => {
    const lines = buildCheckoutLineItems({ brand: "MA_RELIURE", amountDue: due(50_000, 0) }, PRODUCT_IDS);
    expect(lines).toEqual([{ productId: "prod_ma_reliure", unitAmountCents: 60_000, currency: "eur", quantity: 1 }]);
  });

  it("ajoute la ligne transport (TTC) seulement si elle est non nulle", () => {
    const lines = buildCheckoutLineItems({ brand: "MA_RELIURE", amountDue: due(50_000, 1_500) }, PRODUCT_IDS);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toEqual({ productId: "prod_shipping", unitAmountCents: 1_800, currency: "eur", quantity: 1 });
  });

  it("Fine Bindery pointe vers son propre Product, jamais celui de Ma Reliure", () => {
    const lines = buildCheckoutLineItems({ brand: "FINE_BINDERY", amountDue: due(65_000, 0) }, PRODUCT_IDS);
    expect(lines[0].productId).toBe("prod_fine_bindery");
    // Le module ne connaît aucun coefficient : 65 000 HT est déjà le résultat final (§11), 78 000 TTC.
    expect(lines[0].unitAmountCents).toBe(78_000);
  });
});

/**
 * Correction technique de l'utilisateur (16 septembre 2026) : pour les
 * paiements carte, Stripe combine `statement_descriptor_suffix` avec le
 * préfixe raccourci du compte — jamais `PaymentIntent.statement_descriptor`
 * seul. Ce suffixe doit toujours venir du brand de la proposition, jamais
 * du navigateur.
 */
describe("statementDescriptorSuffixForBrand", () => {
  it("un suffixe distinct par marque, sans caractères interdits ni accents", () => {
    expect(statementDescriptorSuffixForBrand("MA_RELIURE")).toBe("MARELIURE");
    expect(statementDescriptorSuffixForBrand("FINE_BINDERY")).toBe("FINEBINDERY");
  });

  it("tient sous la limite Stripe de 22 caractères combinés avec le préfixe cible OPPE", () => {
    const PREFIX = "OPPE";
    for (const brand of ["MA_RELIURE", "FINE_BINDERY"] as const) {
      const combined = `${PREFIX}*${statementDescriptorSuffixForBrand(brand)}`;
      expect(combined.length).toBeLessThanOrEqual(22);
      expect(combined).toMatch(/^[A-Z*]+$/); // que des lettres majuscules et le séparateur
    }
  });
});
