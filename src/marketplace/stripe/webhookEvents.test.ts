import { describe, expect, it } from "vitest";
import { decideWebhookAction, type StripeEventLike } from "./webhookEvents";

const session = (over: Record<string, unknown> = {}, type = "checkout.session.completed"): StripeEventLike => ({
  type,
  data: {
    object: {
      id: "cs_123",
      metadata: { case_id: "case-1", proposal_id: "proposal-1" },
      payment_intent: "pi_123",
      payment_status: "paid",
      amount_total: 60_000,
      currency: "eur",
      ...over,
    },
  },
});

describe("decideWebhookAction — un paiement se prouve, il ne se présume pas", () => {
  it("checkout.session.completed PAYÉ → une preuve de paiement (session, PaymentIntent, montant, devise)", () => {
    expect(decideWebhookAction(session())).toEqual({
      kind: "mark_paid",
      caseId: "case-1",
      proposalId: "proposal-1",
      evidence: {
        source: "checkout_session",
        paymentStatus: "paid",
        amountCents: 60_000,
        currency: "eur",
        checkoutSessionId: "cs_123",
        paymentIntentId: "pi_123",
        invoiceId: null,
      },
    });
  });

  it("checkout.session.completed UNPAID (paiement asynchrone en attente) → journalisé, JAMAIS marqué payé", () => {
    expect(decideWebhookAction(session({ payment_status: "unpaid" }))).toEqual({
      kind: "log",
      eventName: "CUSTOMER_PAYMENT_PENDING",
      caseId: "case-1",
    });
  });

  it("checkout.session.completed NO_PAYMENT_REQUIRED → jamais marqué payé (nous n'avons aucun Checkout gratuit)", () => {
    expect(decideWebhookAction(session({ payment_status: "no_payment_required", amount_total: 0 }))).toEqual({
      kind: "log",
      eventName: "CUSTOMER_PAYMENT_NOT_CONFIRMED",
      caseId: "case-1",
    });
  });

  it("un statut absent ou inconnu n'est pas un paiement", () => {
    expect(decideWebhookAction(session({ payment_status: undefined })).kind).toBe("log");
    expect(decideWebhookAction(session({ payment_status: "mystery" })).kind).toBe("log");
  });

  it("checkout.session.async_payment_succeeded → la confirmation du paiement asynchrone", () => {
    expect(decideWebhookAction(session({}, "checkout.session.async_payment_succeeded"))).toMatchObject({
      kind: "mark_paid",
      evidence: { source: "checkout_session", checkoutSessionId: "cs_123", amountCents: 60_000 },
    });
  });

  it("checkout.session.async_payment_failed → journalisé comme échec, sans changer l'état de paiement", () => {
    expect(decideWebhookAction(session({ payment_status: "unpaid" }, "checkout.session.async_payment_failed"))).toEqual({
      kind: "log",
      eventName: "CUSTOMER_PAYMENT_FAILED",
      caseId: "case-1",
    });
  });

  it("accepte payment_intent et invoice en objet expand, pas seulement en id", () => {
    const result = decideWebhookAction(session({ payment_intent: { id: "pi_expanded" }, invoice: { id: "in_expanded" } }));
    expect(result).toMatchObject({ evidence: { paymentIntentId: "pi_expanded", invoiceId: "in_expanded" } });
  });

  it("payment_intent.succeeded → preuve tirée de amount_received, sans id de session", () => {
    const event: StripeEventLike = {
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_456",
          metadata: { case_id: "case-2", proposal_id: "proposal-2" },
          status: "succeeded",
          amount_received: 60_000,
          currency: "eur",
        },
      },
    };
    expect(decideWebhookAction(event)).toEqual({
      kind: "mark_paid",
      caseId: "case-2",
      proposalId: "proposal-2",
      evidence: {
        source: "payment_intent",
        paymentStatus: "paid",
        amountCents: 60_000,
        currency: "eur",
        checkoutSessionId: null,
        paymentIntentId: "pi_456",
        invoiceId: null,
      },
    });
  });

  it("un PaymentIntent qui n'est pas « succeeded » n'est pas un paiement", () => {
    const event: StripeEventLike = {
      type: "payment_intent.succeeded",
      data: {
        object: { id: "pi_1", metadata: { case_id: "c", proposal_id: "p" }, status: "processing", amount_received: 0, currency: "eur" },
      },
    };
    expect(decideWebhookAction(event).kind).toBe("log");
  });

  /**
   * Ce compte Stripe live sert déjà Métré, AccessBot, BatiScores, MuWo,
   * Securicom (audit du 16 septembre 2026) — un paiement sans notre
   * metadata appartient forcément à l'un d'eux, jamais à deviner.
   */
  it("ignore un paiement sans notre metadata — un autre produit partage ce compte Stripe", () => {
    expect(decideWebhookAction(session({ metadata: {} }))).toEqual({ kind: "ignore" });
    expect(decideWebhookAction(session({ metadata: { case_id: "c" } }))).toEqual({ kind: "ignore" });
    expect(decideWebhookAction(session({ payment_intent: null }))).toEqual({ kind: "ignore" });
  });

  it("journalise les événements de suivi (échec, remboursement, litige, facture) sans changer l'état de paiement", () => {
    const refund: StripeEventLike = {
      type: "charge.refunded",
      data: { object: { id: "ch_1", metadata: { case_id: "case-3" } } },
    };
    expect(decideWebhookAction(refund)).toEqual({ kind: "log", eventName: "REFUND_CREATED", caseId: "case-3" });

    const dispute: StripeEventLike = {
      type: "charge.dispute.created",
      data: { object: { id: "dp_1", metadata: {} } },
    };
    expect(decideWebhookAction(dispute)).toEqual({ kind: "log", eventName: "DISPUTE_OPENED", caseId: null });
  });

  it("ignore un type d'événement hors périmètre plutôt que de le deviner", () => {
    const event: StripeEventLike = {
      type: "customer.updated",
      data: { object: { id: "cus_1", metadata: {} } },
    };
    expect(decideWebhookAction(event)).toEqual({ kind: "ignore" });
  });
});
