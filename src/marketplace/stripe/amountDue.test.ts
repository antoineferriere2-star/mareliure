/**
 * Phase 0 / P1-1 — le montant exigible d'une proposition acceptée est son TTC.
 *
 * Avant : le Checkout envoyait le HT (service + transport) à Stripe ; la TVA validée par
 * l'administrateur n'était jamais encaissée (500 € HT / 600 € TTC → 500 € débités).
 */
import { describe, expect, it } from "vitest";
import { buildCheckoutLineItems, checkoutEligibility } from "./checkoutPlan";
import { resolveAmountDue, type AmountDueInput } from "./amountDue";
import { amountInput } from "./amountDue.fixtures";

const PRODUCT_IDS = { maReliureService: "prod_ma_reliure", fineBinderyService: "prod_fine_bindery", shipping: "prod_shipping" };

describe("resolveAmountDue — le TTC du snapshot", () => {
  it("le cas réel de production : 500 € HT à 20 % → 600 € TTC, pas 500 €", () => {
    const due = resolveAmountDue(amountInput(50_000, 0, 2000));
    expect(due).toMatchObject({ ok: true, amountCents: 60_000, htCents: 50_000, vatCents: 10_000, currency: "eur" });
  });

  it("service + transport : le TTC est celui du snapshot, réparti sur les deux lignes sans écart d'un centime", () => {
    const due = resolveAmountDue(amountInput(43_000, 2_490, 2000));
    if (!due.ok) throw new Error("expected ok");
    expect(due.amountCents).toBe(45_490 + 9_098); // HT 454,90 € + TVA 90,98 €
    expect(due.serviceLineCents + due.shippingLineCents).toBe(due.amountCents);
    expect(due.shippingLineCents).toBe(2_490 + 498); // 24,90 € HT + 4,98 € de TVA
  });

  it("la somme des lignes vaut TOUJOURS le TTC, quels que soient les arrondis (balayage)", () => {
    for (let service = 1; service <= 60; service += 1) {
      for (const shipping of [0, 1, 3, 199, 2_490, 4_995]) {
        for (const rate of [0, 550, 1000, 2000, 2100]) {
          const due = resolveAmountDue(amountInput(service * 137, shipping, rate));
          if (!due.ok) continue; // total nul : refusé, ce n'est pas l'objet ici
          expect(due.serviceLineCents + due.shippingLineCents, `${service * 137}+${shipping}@${rate}`).toBe(due.amountCents);
          expect(due.serviceLineCents).toBeGreaterThanOrEqual(0);
          expect(due.shippingLineCents).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("une TVA à 0 % validée (export) est payable : TTC = HT", () => {
    expect(resolveAmountDue(amountInput(50_000, 1_000, 0))).toMatchObject({ ok: true, amountCents: 51_000, vatCents: 0 });
  });

  it.each([
    ["TVA non résolue (taux absent)", amountInput(50_000, 0, null), "amount_unresolved"],
    ["TTC absent", amountInput(50_000, 0, 2000, { customerTotalTtcCents: null }), "amount_unresolved"],
    ["snapshot trafiqué : TTC ≠ HT + TVA", amountInput(50_000, 0, 2000, { customerTotalTtcCents: 50_000 }), "amount_inconsistent"],
    ["snapshot trafiqué : TVA ≠ taux × HT", amountInput(50_000, 0, 2000, { customerVatAmountCents: 9_999, customerTotalTtcCents: 59_999 }), "amount_inconsistent"],
    ["snapshot trafiqué : HT ≠ service + transport", amountInput(50_000, 0, 2000, { customerTotalHtCents: 40_000 }), "amount_inconsistent"],
    ["montant négatif", amountInput(50_000, 0, 2000, { shippingTotalCents: -1 }), "amount_inconsistent"],
    ["montant fractionnaire", amountInput(50_000, 0, 2000, { customerServicePriceCents: 500.5 }), "amount_inconsistent"],
    ["devise invalide", amountInput(50_000, 0, 2000, { currency: "euros" }), "amount_inconsistent"],
    ["rien à payer", amountInput(0, 0, 2000), "nothing_due"],
  ] as [string, AmountDueInput, string][])("refuse : %s", (_label, input, reason) => {
    expect(resolveAmountDue(input)).toMatchObject({ ok: false, reason });
  });

  it("un acompte bloque (fail closed) : le paiement en deux temps n'existe pas, on ne facture pas le total ni l'acompte", () => {
    expect(resolveAmountDue(amountInput(50_000, 0, 2000, { depositType: "PERCENTAGE", depositAmountCents: 15_000 }))).toMatchObject({
      ok: false,
      reason: "deposit_flow_unsupported",
    });
    expect(resolveAmountDue(amountInput(50_000, 0, 2000, { depositType: "FIXED", depositAmountCents: 0 }))).toMatchObject({
      ok: false,
      reason: "deposit_flow_unsupported",
    });
  });
});

describe("proposition acceptée → Checkout → montant attendu (niveau métier)", () => {
  const accepted = (amount: AmountDueInput, over: Record<string, unknown> = {}) => ({
    status: "accepted",
    acceptedAt: "2026-09-19T10:00:00.000Z",
    taxPolicy: "FR_B2C",
    taxValidatedAt: "2026-09-19T09:00:00.000Z",
    customerType: "CUSTOMER",
    businessName: null,
    alreadyPaid: false,
    amount,
    ...over,
  });

  it("le total des lignes envoyées à Stripe est exactement le TTC engagé", () => {
    const verdict = checkoutEligibility(accepted(amountInput(50_000, 2_490, 2000)));
    if (!verdict.eligible) throw new Error("expected eligible");
    const lines = buildCheckoutLineItems({ brand: "MA_RELIURE", amountDue: verdict.amountDue }, PRODUCT_IDS);
    // 500,00 € + 24,90 € = 524,90 € HT ; TVA 20 % = 104,98 € ; TTC = 629,88 €.
    expect(lines.map((l) => [l.productId, l.unitAmountCents])).toEqual([
      ["prod_ma_reliure", 60_000], // 500,00 € + 100,00 € de TVA
      ["prod_shipping", 2_988], // 24,90 € + 4,98 € de TVA
    ]);
    expect(lines.reduce((sum, l) => sum + l.unitAmountCents * l.quantity, 0)).toBe(62_988);
  });

  it("pas de ligne transport quand il n'y a pas de transport", () => {
    const verdict = checkoutEligibility(accepted(amountInput(50_000, 0, 2000)));
    if (!verdict.eligible) throw new Error("expected eligible");
    const lines = buildCheckoutLineItems({ brand: "FINE_BINDERY", amountDue: verdict.amountDue }, PRODUCT_IDS);
    expect(lines).toEqual([{ productId: "prod_fine_bindery", unitAmountCents: 60_000, currency: "eur", quantity: 1 }]);
  });

  it("une commande dont le montant n'est pas résolu n'est pas payable — l'éligibilité le dit avant Stripe", () => {
    expect(checkoutEligibility(accepted(amountInput(50_000, 0, null)))).toEqual({ eligible: false, reason: "amount_unresolved" });
    expect(checkoutEligibility(accepted(amountInput(50_000, 0, 2000, { depositType: "PERCENTAGE", depositAmountCents: 100 })))).toEqual({
      eligible: false,
      reason: "deposit_flow_unsupported",
    });
  });

  it("les blocages historiques gardent la priorité sur le montant", () => {
    expect(checkoutEligibility(accepted(amountInput(50_000, 0, null), { alreadyPaid: true }))).toEqual({ eligible: false, reason: "already_paid" });
    expect(checkoutEligibility(accepted(amountInput(50_000, 0, null), { taxPolicy: "MANUAL_TAX_REVIEW", taxValidatedAt: null }))).toEqual({
      eligible: false,
      reason: "tax_review_required",
    });
  });
});
