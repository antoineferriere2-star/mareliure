export const MARKETPLACE_EVENT_TYPES = [
  "pricing_generated",
  "pricing_edited",
  "pricing_validated",
  "offer_sent",
  "offer_accepted",
  "offer_declined",
  "binder_selected",
  "case_completed",
  // Membership (Phase A, 11 septembre 2026) — sur binder_id, jamais case_id :
  // marketplace_events.case_id est nullable depuis cette phase pour ça.
  "binder_member_invited",
  "binder_member_invitation_accepted",
  "binder_member_activated",
  // Provenance (Phase A) — sur case_id, posé une seule fois par
  // reconcileCaseTriage au moment où le cas est créé.
  "binder_referral_attributed",
  // Messagerie et décisions (Phase B, 12 septembre 2026).
  "message_sent",
  "decision_requested",
  "decision_answered",
] as const;

export type MarketplaceEventType = (typeof MARKETPLACE_EVENT_TYPES)[number];
