/**
 * Le webhook Stripe live de la marketplace.
 *
 * Vérifie la signature avant de lire quoi que ce soit (§16), journalise
 * chaque événement une seule fois (§17, stripeWebhookLog.server.ts), puis
 * délègue la décision à `decideWebhookAction` (pure, webhookEvents.ts) —
 * ce fichier ne fait qu'exécuter cette décision contre la base.
 *
 * Toujours 200 après un traitement réussi ou un événement hors périmètre :
 * un 4xx/5xx ferait retenter Stripe indéfiniment un événement qui n'est de
 * toute façon pas le nôtre (ce compte sert aussi Métré/BatiScores/MuWo/
 * Securicom — voir l'audit du 16 septembre 2026). Seule une signature
 * invalide renvoie 400.
 */
import { admin } from "@/build/services/adminAuth.server";
import { getMarketplaceStripeClient, getMarketplaceStripeWebhookSecret } from "./stripeClient.server";
import { decideWebhookAction, type StripeEventLike } from "./webhookEvents";
import {
  markWebhookEventFailed,
  markWebhookEventProcessed,
  recordWebhookEventOnce,
} from "@/marketplace/services/stripeWebhookLog.server";
import { markCommercialPaymentSucceeded } from "@/marketplace/services/commercialPaymentRepository.server";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export async function handleStripeWebhookRequest(request: Request): Promise<Response> {
  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();
  if (!signature) return json(400, { error: "Missing stripe-signature header" });

  const stripe = getMarketplaceStripeClient();
  let event: StripeEventLike;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      getMarketplaceStripeWebhookSecret(),
    ) as unknown as StripeEventLike;
  } catch (err) {
    const { logOperationalError } = await import("@/build/services/operationalLog.server");
    logOperationalError("stripe-webhook.invalid-signature", err, {});
    return json(400, { error: "Invalid signature" });
  }

  const sb = await admin();
  const isNew = await recordWebhookEventOnce(sb, {
    id: (event as unknown as { id: string }).id,
    type: event.type,
    payload: event,
  });
  if (!isNew) {
    // Redélivrance d'un événement déjà traité — accusé réception, jamais
    // rejoué (§17).
    return json(200, { ok: true, duplicate: true });
  }

  const eventId = (event as unknown as { id: string }).id;
  try {
    const action = decideWebhookAction(event);
    if (action.kind === "mark_paid") {
      await markCommercialPaymentSucceeded(sb, action.proposalId, {
        paymentIntentId: action.paymentIntentId,
        invoiceId: action.invoiceId,
      });
      await sb.from("marketplace_events").insert({
        case_id: action.caseId,
        event_type: "CUSTOMER_PAYMENT_SUCCEEDED",
        metadata: { proposal_id: action.proposalId, payment_intent_id: action.paymentIntentId },
      });
    } else if (action.kind === "log" && action.caseId) {
      await sb.from("marketplace_events").insert({
        case_id: action.caseId,
        event_type: action.eventName,
        metadata: { stripe_event_id: eventId, stripe_event_type: event.type },
      });
    }
    // action "ignore", ou "log" sans case_id identifiable (un autre produit
    // sur ce même compte Stripe) : rien à écrire dans notre propre journal.
    await markWebhookEventProcessed(sb, eventId);
    return json(200, { ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markWebhookEventFailed(sb, eventId, message);
    const { logOperationalError } = await import("@/build/services/operationalLog.server");
    logOperationalError("stripe-webhook.processing-failed", err, { eventId, type: event.type });
    // 200 malgré tout : l'événement est déjà journalisé pour investigation
    // manuelle (processing_error) — le rejeter ferait retenter Stripe sans
    // qu'aucun retry n'ait de raison de mieux réussir (§22 s'applique à
    // refuser un Checkout, pas à transformer un webhook en boucle infinie).
    return json(200, { ok: false, error: "processing_failed" });
  }
}
