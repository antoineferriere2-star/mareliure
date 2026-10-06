import { beforeEach, describe, expect, it, vi } from "vitest";
import { inspectWorkshopCheckout, recoverWorkshopCheckout } from "./checkoutRecovery.server";
const retrieve = vi.fn();
const intent = vi.fn();
const cancel = vi.fn();
const list = vi.fn();
const stripe = {
  checkout: { sessions: { retrieve, list } },
  paymentIntents: { retrieve: intent, cancel },
} as never;
const options = { stripeAccount: "acct_seller" };
beforeEach(() => {
  vi.resetAllMocks();
});
describe("reprise sans deuxième encaissement", () => {
  it("réutilise la session ouverte du vendeur", async () => {
    retrieve.mockResolvedValue({ status: "open", url: "https://checkout.stripe.com/qa" });
    expect(await inspectWorkshopCheckout(stripe, "cs_1", options)).toMatchObject({ kind: "open" });
    expect(cancel).not.toHaveBeenCalled();
  });
  it.each([
    "succeeded",
    "processing",
    "requires_action",
    "requires_capture",
    "requires_confirmation",
  ])("bloque une autre tentative tant que le paiement est %s", async (status) => {
    retrieve.mockResolvedValue({
      status: "complete",
      payment_status: "unpaid",
      payment_intent: "pi_1",
    });
    intent.mockResolvedValue({ status });
    await expect(inspectWorkshopCheckout(stripe, "cs_1", options)).rejects.toThrow(
      "payment_pending_reconciliation",
    );
    expect(cancel).not.toHaveBeenCalled();
  });
  it("annule définitivement le paiement échoué avant de libérer sa réservation", async () => {
    retrieve.mockResolvedValue({
      status: "complete",
      payment_status: "unpaid",
      payment_intent: "pi_1",
    });
    intent.mockResolvedValue({ status: "requires_payment_method" });
    cancel.mockResolvedValue({ status: "canceled" });
    expect(await inspectWorkshopCheckout(stripe, "cs_1", options)).toEqual({
      kind: "terminal",
      reason: "canceled",
      intentId: "pi_1",
    });
    expect(cancel).toHaveBeenCalledWith(
      "pi_1",
      { cancellation_reason: "abandoned" },
      { ...options, idempotencyKey: "workshop-retry-cancel-pi_1" },
    );
  });
  it("conserve le verrou si Stripe refuse l’annulation lors d’une course avec le succès", async () => {
    retrieve.mockResolvedValue({ status: "complete", payment_intent: "pi_1" });
    intent.mockResolvedValue({ status: "requires_payment_method" });
    cancel.mockRejectedValue(new Error("intent_already_succeeded"));
    await expect(inspectWorkshopCheckout(stripe, "cs_1", options)).rejects.toThrow(
      "intent_already_succeeded",
    );
  });
  it("autorise une session expirée sans encaissement, jamais une session payée", async () => {
    retrieve.mockResolvedValue({ status: "expired", payment_status: "unpaid" });
    expect(await inspectWorkshopCheckout(stripe, "cs_1", options)).toMatchObject({
      kind: "terminal",
      reason: "expired",
    });
    retrieve.mockResolvedValue({ status: "complete", payment_status: "paid" });
    await expect(inspectWorkshopCheckout(stripe, "cs_1", options)).rejects.toThrow();
  });
  it("retrouve une réponse perdue par la preuve Stripe du bon dossier et du bon vendeur", async () => {
    list.mockReturnValue(
      (async function* () {
        yield { id: "cs_other", metadata: { payment_id: "other" } };
        yield { id: "cs_saved", metadata: { payment_id: "ours" } };
      })(),
    );
    expect(
      await recoverWorkshopCheckout(
        stripe,
        "2026-10-06T09:00:00Z",
        { payment_id: "ours" },
        options,
      ),
    ).toMatchObject({ id: "cs_saved" });
    expect(list).toHaveBeenCalledWith(
      { created: { gte: 1791273600, lte: 1791277200 }, limit: 100 },
      options,
    );
  });
});
