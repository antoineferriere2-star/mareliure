import { describe, expect, it } from "vitest";
import { decideWebhookAction, type StripeEventLike } from "./webhookEvents";

describe("decideWebhookAction", () => {
  it("marque payé sur checkout.session.completed avec notre metadata", () => {
    const event: StripeEventLike = {
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_123",
          metadata: { case_id: "case-1", proposal_id: "proposal-1" },
          payment_intent: "pi_123",
        },
      },
    };
    expect(decideWebhookAction(event)).toEqual({
      kind: "mark_paid",
      caseId: "case-1",
      proposalId: "proposal-1",
      paymentIntentId: "pi_123",
      invoiceId: null,
    });
  });

  it("accepte payment_intent en objet expand, pas seulement en id", () => {
    const event: StripeEventLike = {
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_123",
          metadata: { case_id: "case-1", proposal_id: "proposal-1" },
          payment_intent: { id: "pi_expanded" },
          invoice: { id: "in_expanded" },
        },
      },
    };
    const result = decideWebhookAction(event);
    expect(result).toMatchObject({ paymentIntentId: "pi_expanded", invoiceId: "in_expanded" });
  });

  it("marque payé sur payment_intent.succeeded, avec son propre id comme paymentIntentId", () => {
    const event: StripeEventLike = {
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_456", metadata: { case_id: "case-2", proposal_id: "proposal-2" } } },
    };
    expect(decideWebhookAction(event)).toEqual({
      kind: "mark_paid",
      caseId: "case-2",
      proposalId: "proposal-2",
      paymentIntentId: "pi_456",
      invoiceId: null,
    });
  });

  /**
   * Ce compte Stripe live sert déjà Métré, AccessBot, BatiScores, MuWo,
   * Securicom (audit du 16 septembre 2026) — un paiement sans notre
   * metadata appartient forcément à l'un d'eux, jamais à deviner.
   */
  it("ignore un paiement sans notre metadata — un autre produit partage ce compte Stripe", () => {
    const event: StripeEventLike = {
      type: "checkout.session.completed",
      data: { object: { id: "cs_999", metadata: {}, payment_intent: "pi_999" } },
    };
    expect(decideWebhookAction(event)).toEqual({ kind: "ignore" });
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
