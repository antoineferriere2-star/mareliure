/**
 * L'écriture d'un événement de la marketplace, côté serveur uniquement.
 *
 * Un module à part plutôt qu'une fonction du référentiel de prix : le fil de
 * projet écrit des événements sans rien avoir à lire de la grille tarifaire.
 *
 * L'échec d'une écriture est journalisé, jamais propagé : perdre une ligne
 * d'analyse ne doit pas annuler le geste qui l'a produite. Les événements qui
 * font foi — un tarif changé, un prix de dossier validé — sont écrits par les
 * fonctions SQL, dans la même transaction.
 */
import type { Supa } from "@/build/services/adminAuth.server";
import type { Json } from "@/integrations/supabase/types";
import type { MarketplaceEventType } from "@/marketplace/analytics/events";

export async function recordMarketplaceEvent(
  sb: Supa,
  event: {
    type: MarketplaceEventType;
    actorUserId: string;
    caseId?: string | null;
    binderId?: string | null;
    metadata: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await sb.from("marketplace_events").insert({
    case_id: event.caseId ?? null,
    binder_id: event.binderId ?? null,
    actor_user_id: event.actorUserId,
    event_type: event.type,
    metadata: event.metadata as Json,
  });
  if (error) console.error(`[marketplace_events] ${event.type} non enregistré : ${error.message}`);
}
