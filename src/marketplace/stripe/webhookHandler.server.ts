/**
 * Le webhook Stripe live de la marketplace.
 *
 * Vérifie la signature avant de lire quoi que ce soit (§16), réclame l'événement (état
 * `processing`, stripeWebhookLog.server.ts), puis délègue la décision à `decideWebhookAction`
 * (pure, webhookEvents.ts) et la vérification du paiement à `verifyPaymentEvidence` (pure,
 * paymentVerification.ts) — ce fichier ne fait qu'exécuter contre la base.
 *
 * Réponses (Phase 0 / P1-2, P1-3) :
 * - 200 : événement traité, événement hors périmètre (un autre produit partage ce compte Stripe —
 *   Métré/BatiScores/MuWo/Securicom, audit du 16 septembre 2026), ou doublon d'un événement DÉJÀ
 *   TRAITÉ ;
 * - 400 : signature invalide ;
 * - 409 : le même événement est en cours de traitement ailleurs — Stripe réessaiera ;
 * - 500 : le traitement a échoué (erreur d'infrastructure OU paiement qui ne correspond pas à la
 *   proposition). L'événement est `failed` avec la raison, jamais `processed` : Stripe le
 *   redélivre, la redélivrance le REPREND (`claimed`, tentative + 1) au lieu de l'absorber comme
 *   doublon. Après `MAX_WEBHOOK_ATTEMPTS` tentatives on répond 200 pour arrêter la boucle — la
 *   ligne reste `failed`, visible et rejouable depuis le Dashboard Stripe.
 */
import { admin } from "@/build/services/adminAuth.server";
import { getMarketplaceStripeClient, getMarketplaceStripeWebhookSecret } from "./stripeClient.server";
import { decideWebhookAction, type StripeEventLike } from "./webhookEvents";
import { verifyPaymentEvidence } from "./paymentVerification";
import {
  claimWebhookEvent,
  markWebhookEventFailed,
  markWebhookEventProcessed,
} from "@/marketplace/services/stripeWebhookLog.server";
import {
  loadCommercialPaymentState,
  markCommercialPaymentSucceeded,
} from "@/marketplace/services/commercialPaymentRepository.server";
import { loadCommercialProposalById } from "@/marketplace/services/commercialProposalRepository.server";

/** Au-delà, on cesse de faire retenter Stripe (l'événement reste `failed`, à traiter à la main). */
export const MAX_WEBHOOK_ATTEMPTS = 8;

type Supa = Awaited<ReturnType<typeof admin>>;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

type Outcome = { ok: true } | { ok: false; reason: string; detail: string };

/**
 * Le journal `CUSTOMER_PAYMENT_SUCCEEDED`, écrit UNE fois par PaymentIntent — même si le paiement a
 * été enregistré par une tentative précédente qui s'est arrêtée avant d'écrire le journal, ou si
 * l'autre événement du même paiement (session + PaymentIntent) est arrivé le premier.
 */
async function ensurePaymentJournal(sb: Supa, input: { caseId: string; proposalId: string; paymentIntentId: string }) {
  const existing = await sb
    .from("marketplace_events")
    .select("id")
    .eq("case_id", input.caseId)
    .eq("event_type", "CUSTOMER_PAYMENT_SUCCEEDED")
    .contains("metadata", { payment_intent_id: input.paymentIntentId })
    .limit(1);
  if (existing.error) throw existing.error;
  if ((existing.data ?? []).length > 0) return;
  const { error } = await sb.from("marketplace_events").insert({
    case_id: input.caseId,
    event_type: "CUSTOMER_PAYMENT_SUCCEEDED",
    metadata: { proposal_id: input.proposalId, payment_intent_id: input.paymentIntentId },
  });
  if (error) throw error;
}

async function processEvent(sb: Supa, event: StripeEventLike, eventId: string): Promise<Outcome> {
  const action = decideWebhookAction(event);

  if (action.kind === "mark_paid") {
    const proposal = await loadCommercialProposalById(sb, action.proposalId);
    const payment = proposal ? await loadCommercialPaymentState(sb, proposal.id) : null;
    const verdict = verifyPaymentEvidence({ evidence: action.evidence, claimedCaseId: action.caseId, proposal, payment });
    if (!verdict.ok) return { ok: false, reason: verdict.reason, detail: verdict.detail };

    if (!verdict.alreadyRecorded) {
      const recorded = await markCommercialPaymentSucceeded(sb, action.proposalId, {
        paymentIntentId: action.evidence.paymentIntentId,
        invoiceId: action.evidence.invoiceId,
        amountCents: verdict.amountDue.amountCents,
        currency: verdict.amountDue.currency,
      });
      // Un autre PaymentIntent a été enregistré entre la vérification et l'écriture : double paiement,
      // rien n'a été écrasé — signalé, jamais avalé.
      if (recorded === "other_payment") {
        return { ok: false, reason: "duplicate_payment", detail: `concurrent payment recorded before ${action.evidence.paymentIntentId}` };
      }
    }
    await ensurePaymentJournal(sb, {
      caseId: action.caseId,
      proposalId: action.proposalId,
      paymentIntentId: action.evidence.paymentIntentId,
    });
    return { ok: true };
  }

  if (action.kind === "log" && action.caseId) {
    const { error } = await sb.from("marketplace_events").insert({
      case_id: action.caseId,
      event_type: action.eventName,
      metadata: { stripe_event_id: eventId, stripe_event_type: event.type },
    });
    if (error) throw error;
  }
  // action "ignore", ou "log" sans case_id identifiable (un autre produit sur ce même compte
  // Stripe) : rien à écrire dans notre propre journal.
  return { ok: true };
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
  const eventId = (event as unknown as { id: string }).id;

  // Une erreur ici (base injoignable) n'est pas rattrapée : la requête échoue en 5xx et Stripe redélivre.
  const claim = await claimWebhookEvent(sb, { id: eventId, type: event.type, payload: event });
  if (claim.outcome === "already_processed") {
    // Redélivrance d'un événement déjà TRAITÉ — accusé réception, jamais rejoué (§17).
    return json(200, { ok: true, duplicate: true });
  }
  if (claim.outcome === "in_progress") {
    return json(409, { ok: false, error: "in_progress" });
  }

  const { logOperationalError } = await import("@/build/services/operationalLog.server");
  let failure: { reason: string; detail: string };
  try {
    const outcome = await processEvent(sb, event, eventId);
    if (outcome.ok) {
      await markWebhookEventProcessed(sb, eventId);
      return json(200, { ok: true });
    }
    failure = outcome;
    logOperationalError("stripe-webhook.payment-rejected", new Error(`${outcome.reason}: ${outcome.detail}`), {
      eventId,
      type: event.type,
      attempts: claim.attempts,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    failure = { reason: "processing_error", detail: message };
    logOperationalError("stripe-webhook.processing-failed", err, { eventId, type: event.type, attempts: claim.attempts });
  }

  try {
    await markWebhookEventFailed(sb, eventId, `${failure.reason}: ${failure.detail}`);
  } catch (err) {
    // La ligne reste `processing` : elle sera reprise à l'expiration du délai, jamais perdue.
    logOperationalError("stripe-webhook.mark-failed-failed", err, { eventId });
  }
  const giveUp = claim.attempts >= MAX_WEBHOOK_ATTEMPTS;
  return json(giveUp ? 200 : 500, { ok: false, error: "processing_failed", reason: failure.reason, attempts: claim.attempts, giveUp });
}
