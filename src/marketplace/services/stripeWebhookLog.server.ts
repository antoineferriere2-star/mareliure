/**
 * L'idempotence des webhooks Stripe (§17) : `marketplace_stripe_webhook_events`
 * (migration 20260916120000) garde chaque `event.id` une seule fois — Stripe
 * lui-même le garantit stable à travers ses propres redélivrances, la
 * `PRIMARY KEY` est la garantie, pas une convention applicative.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

type Supa = SupabaseClient<Database>;

/**
 * Insère l'événement s'il est nouveau. `true` = première fois qu'on le voit
 * (à traiter) ; `false` = déjà connu (accusé réception, jamais retraité).
 */
export async function recordWebhookEventOnce(
  sb: Supa,
  event: { id: string; type: string; payload: unknown },
): Promise<boolean> {
  const { error } = await sb
    .from("marketplace_stripe_webhook_events")
    .insert({ id: event.id, type: event.type, payload: event.payload as unknown as Json })
    // Redélivrance Stripe du même event.id : la ligne existe déjà, ce n'est
    // pas une erreur à faire remonter — c'est exactement ce que cette table
    // existe pour absorber.
    .select("id");
  if (!error) return true;
  if (error.code === "23505") return false; // unique_violation
  throw error;
}

export async function markWebhookEventProcessed(sb: Supa, eventId: string): Promise<void> {
  const { error } = await sb
    .from("marketplace_stripe_webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("id", eventId);
  if (error) throw error;
}

export async function markWebhookEventFailed(sb: Supa, eventId: string, message: string): Promise<void> {
  const { error } = await sb
    .from("marketplace_stripe_webhook_events")
    .update({ processing_error: message })
    .eq("id", eventId);
  if (error) throw error;
}
