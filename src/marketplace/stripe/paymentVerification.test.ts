import { describe, expect, it } from "vitest";
import { amountInput } from "./amountDue.fixtures";
import { verifyPaymentEvidence, type PaymentFacts, type ProposalFacts } from "./paymentVerification";
import type { PaymentEvidence } from "./webhookEvents";

const proposal = (over: Partial<ProposalFacts> = {}): ProposalFacts => ({
  id: "proposal-1",
  caseId: "case-1",
  status: "accepted",
  acceptedAt: "2026-09-19T10:00:00.000Z",
  ...amountInput(50_000, 0, 2000),
  ...over,
});
const evidence = (over: Partial<PaymentEvidence> = {}): PaymentEvidence => ({
  source: "checkout_session",
  paymentStatus: "paid",
  amountCents: 60_000,
  currency: "eur",
  checkoutSessionId: "cs_1",
  paymentIntentId: "pi_1",
  invoiceId: null,
  ...over,
});
const openPayment: PaymentFacts = { stripeCheckoutSessionId: "cs_1", stripePaymentIntentId: null, paidAt: null };
const verify = (o: { evidence?: PaymentEvidence; proposal?: ProposalFacts | null; payment?: PaymentFacts | null; claimedCaseId?: string } = {}) =>
  verifyPaymentEvidence({
    evidence: o.evidence ?? evidence(),
    claimedCaseId: o.claimedCaseId ?? "case-1",
    proposal: o.proposal === undefined ? proposal() : o.proposal,
    payment: o.payment === undefined ? openPayment : o.payment,
  });

describe("verifyPaymentEvidence", () => {
  it("le bon montant TTC, la bonne devise, la bonne session, la bonne proposition → payé", () => {
    expect(verify()).toMatchObject({ ok: true, alreadyRecorded: false, amountDue: { amountCents: 60_000, currency: "eur" } });
  });

  it("la devise se compare sans tenir compte de la casse", () => {
    expect(verify({ evidence: evidence({ currency: "EUR" }) }).ok).toBe(true);
  });

  it.each([
    ["montant HT au lieu du TTC (l'ancien défaut)", { amountCents: 50_000 }, "amount_mismatch"],
    ["montant supérieur", { amountCents: 60_001 }, "amount_mismatch"],
    ["montant absent", { amountCents: null }, "amount_mismatch"],
    ["montant nul", { amountCents: 0 }, "amount_mismatch"],
    ["autre devise", { currency: "usd" }, "currency_mismatch"],
    ["devise absente", { currency: null }, "currency_mismatch"],
    ["paiement non confirmé", { paymentStatus: "unpaid" }, "payment_not_confirmed"],
    ["aucun paiement requis", { paymentStatus: "no_payment_required" }, "payment_not_confirmed"],
    ["statut absent", { paymentStatus: null }, "payment_not_confirmed"],
    ["autre session Checkout", { checkoutSessionId: "cs_other" }, "session_mismatch"],
  ] as [string, Partial<PaymentEvidence>, string][])("refuse : %s", (_label, over, reason) => {
    expect(verify({ evidence: evidence(over) })).toMatchObject({ ok: false, reason });
  });

  it("refuse une proposition inconnue", () => {
    expect(verify({ proposal: null })).toMatchObject({ ok: false, reason: "proposal_unknown" });
  });

  it("refuse une metadata dont le dossier n'est pas celui de la proposition", () => {
    expect(verify({ claimedCaseId: "case-OTHER" })).toMatchObject({ ok: false, reason: "case_mismatch" });
  });

  it("refuse une proposition qui n'est pas acceptée", () => {
    expect(verify({ proposal: proposal({ status: "proposed", acceptedAt: null }) })).toMatchObject({
      ok: false,
      reason: "proposal_not_accepted",
    });
  });

  it("refuse une proposition dont le montant n'est pas payable (TVA non résolue, snapshot incohérent, acompte)", () => {
    expect(verify({ proposal: proposal(amountInput(50_000, 0, null)) })).toMatchObject({ ok: false, reason: "amount_not_payable" });
    expect(verify({ proposal: proposal({ customerTotalTtcCents: 1 }) })).toMatchObject({ ok: false, reason: "amount_not_payable" });
    expect(verify({ proposal: proposal({ depositType: "PERCENTAGE", depositAmountCents: 100 }) })).toMatchObject({
      ok: false,
      reason: "amount_not_payable",
    });
  });

  it("refuse une session qu'aucun de nos Checkout n'a créée (aucune session enregistrée)", () => {
    expect(verify({ payment: null })).toMatchObject({ ok: false, reason: "session_mismatch" });
  });

  it("un événement PaymentIntent n'a pas d'id de session : il est rattaché par metadata, montant et devise", () => {
    const pi = evidence({ source: "payment_intent", checkoutSessionId: null });
    expect(verify({ evidence: pi, payment: null }).ok).toBe(true);
    expect(verify({ evidence: { ...pi, amountCents: 50_000 }, payment: null })).toMatchObject({ ok: false, reason: "amount_mismatch" });
  });

  it("le même PaymentIntent rejoué (doublon, reprise) → succès sans rien réécrire", () => {
    const paid: PaymentFacts = { stripeCheckoutSessionId: "cs_1", stripePaymentIntentId: "pi_1", paidAt: "2026-09-19T11:00:00.000Z" };
    expect(verify({ payment: paid })).toMatchObject({ ok: true, alreadyRecorded: true });
  });

  it("un AUTRE PaymentIntent sur une commande déjà payée → double paiement signalé, rien n'est écrasé", () => {
    const paid: PaymentFacts = { stripeCheckoutSessionId: "cs_1", stripePaymentIntentId: "pi_1", paidAt: "2026-09-19T11:00:00.000Z" };
    expect(verify({ evidence: evidence({ paymentIntentId: "pi_2" }), payment: paid })).toMatchObject({
      ok: false,
      reason: "duplicate_payment",
    });
  });
});
