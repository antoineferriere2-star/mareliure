import type Stripe from "stripe";

/** A failed, completed Checkout is reusable only after its intent is irrevocably canceled. */
export async function inspectWorkshopCheckout(
  stripe: Stripe,
  sessionId: string,
  options: Stripe.RequestOptions = {},
) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {}, options);
  if (session.status === "open" && session.url) return { kind: "open" as const, url: session.url };
  if (session.status !== "expired" && session.status !== "complete")
    throw new Error("payment_pending_reconciliation");
  const intentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (session.payment_status === "paid") throw new Error("payment_pending_reconciliation");
  if (intentId) {
    let intent = await stripe.paymentIntents.retrieve(intentId, {}, options);
    if (intent.status === "requires_payment_method") {
      // Cancellation races safely with an asynchronous success: Stripe refuses the cancel.
      intent = await stripe.paymentIntents.cancel(
        intentId,
        { cancellation_reason: "abandoned" },
        { ...options, idempotencyKey: `workshop-retry-cancel-${intentId}` },
      );
    }
    if (intent.status !== "canceled") throw new Error("payment_pending_reconciliation");
    return { kind: "terminal" as const, reason: "canceled", intentId };
  }
  if (session.status !== "expired") throw new Error("payment_pending_reconciliation");
  return { kind: "terminal" as const, reason: "expired", intentId: null };
}

/** Recover a lost create response before minting another idempotency generation. */
export async function recoverWorkshopCheckout(
  stripe: Stripe,
  expiresAt: string | null,
  metadata: Record<string, string>,
  options: Stripe.RequestOptions = {},
) {
  if (!expiresAt) return null;
  const end = Math.floor(Date.parse(expiresAt) / 1000);
  for await (const session of stripe.checkout.sessions.list(
    { created: { gte: end - 3600, lte: end }, limit: 100 },
    options,
  )) {
    if (Object.entries(metadata).every(([key, value]) => session.metadata?.[key] === value))
      return session;
  }
  return null;
}
