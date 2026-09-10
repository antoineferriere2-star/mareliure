/**
 * Les événements de la marketplace, écrits dans `marketplace_events`.
 *
 * Deux familles. Les événements de dossier portent un `case_id`. Les
 * événements du référentiel — une grille saisie, un prix publié, une
 * simulation — n'en ont pas : ils racontent comment Ma Reliure a construit ses
 * prix, pas ce qui est arrivé à un livre.
 */
export const MARKETPLACE_EVENT_TYPES = [
  "pricing_generated",
  "pricing_manual_review",
  "pricing_validated",
  "pricing_overridden",
  "pricing_simulated",
  "pricebook_updated",
  "pricing_work_item_updated",
  "binder_rate_created",
  "binder_rate_updated",
  "offer_sent",
  "offer_accepted",
  "offer_declined",
  "binder_selected",
  "case_completed",
] as const;

export type MarketplaceEventType = (typeof MARKETPLACE_EVENT_TYPES)[number];

/** Les événements qui ne concernent aucun dossier. */
export const REFERENCE_EVENT_TYPES = [
  "pricing_simulated",
  "pricebook_updated",
  "pricing_work_item_updated",
  "binder_rate_created",
  "binder_rate_updated",
] as const satisfies readonly MarketplaceEventType[];
