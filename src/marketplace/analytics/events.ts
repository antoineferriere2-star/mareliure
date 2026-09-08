export const MARKETPLACE_EVENT_TYPES = [
  "pricing_generated",
  "pricing_edited",
  "pricing_validated",
  "offer_sent",
  "offer_accepted",
  "offer_declined",
  "binder_selected",
  "case_completed",
] as const;

export type MarketplaceEventType = (typeof MARKETPLACE_EVENT_TYPES)[number];
