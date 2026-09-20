/**
 * L'état de chaque événement Stripe (§17) : `marketplace_stripe_webhook_events`
 * (migrations 20260916120000 et 20260920110000).
 *
 *   received ─▶ processing ─▶ processed            (terminal : un doublon est accusé, jamais rejoué)
 *                    └──────▶ failed ─▶ processing   (reprise idempotente à la redélivrance)
 *
 * Défaut corrigé (Phase 0 / P1-3) : la première version gardait `event.id` en clé primaire et
 * traitait toute redélivrance comme un doublon — y compris celle d'un événement dont le traitement
 * avait ÉCHOUÉ. Un paiement encaissé pouvait ne jamais être enregistré. Désormais seul un
 * événement `processed` est absorbé ; un `failed` (ou un `processing` abandonné) est repris.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

type Supa = SupabaseClient<Database>;

export type WebhookClaim =
  /** À traiter : première livraison, ou reprise d'un événement en échec / abandonné. */
  | { outcome: "claimed"; attempts: number }
  /** Doublon d'un événement terminé — accusé de réception, jamais rejoué. */
  | { outcome: "already_processed"; attempts: number }
  /** Un autre worker le traite en ce moment — Stripe réessaiera. */
  | { outcome: "in_progress"; attempts: number };

/**
 * Réclame l'événement pour traitement, de façon atomique (verrou de ligne côté base :
 * `marketplace_claim_webhook_event`). Toute erreur d'infrastructure remonte — le gestionnaire
 * répond alors non-2xx et Stripe redélivre.
 */
export async function claimWebhookEvent(
  sb: Supa,
  event: { id: string; type: string; payload: unknown },
): Promise<WebhookClaim> {
  const { data, error } = await sb.rpc("marketplace_claim_webhook_event", {
    p_id: event.id,
    p_type: event.type,
    p_payload: event.payload as unknown as Json,
  });
  if (error) throw error;
  const row = (data ?? [])[0];
  if (!row || !["claimed", "already_processed", "in_progress"].includes(row.claim_outcome)) {
    throw new Error("marketplace_claim_webhook_event returned no usable outcome");
  }
  return { outcome: row.claim_outcome as WebhookClaim["outcome"], attempts: row.claim_attempts };
}

/** Terminal : seul un traitement réellement abouti amène ici. */
export async function markWebhookEventProcessed(sb: Supa, eventId: string): Promise<void> {
  const { error } = await sb
    .from("marketplace_stripe_webhook_events")
    .update({ status: "processed", processed_at: new Date().toISOString(), processing_error: null })
    .eq("id", eventId)
    .eq("status", "processing");
  if (error) throw error;
}

/** L'échec est visible et rejouable : `failed` + la dernière erreur. Jamais `processed`. */
export async function markWebhookEventFailed(sb: Supa, eventId: string, message: string): Promise<void> {
  const { error } = await sb
    .from("marketplace_stripe_webhook_events")
    .update({ status: "failed", processing_error: message.slice(0, 1000) })
    .eq("id", eventId)
    .eq("status", "processing");
  if (error) throw error;
}
