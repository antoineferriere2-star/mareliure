/**
 * Fixed identifiers for the always-public Deck demo Mission. A `public_token`
 * is designed to be a shareable, non-sensitive identifier for a published
 * Mission (see build-runtime.ts) — safe to commit.
 */
export const DECK_PLAYBOOK_ID = "00000000-0000-4000-8000-000000000001";
export const DECK_MISSION_ID = "00000000-0000-4000-8000-000000000002";
export const DECK_DEMO_PUBLIC_TOKEN = "deck-demo-public-token-000001";

/**
 * The Bookbinding vertical: its curated Playbook, the workspace the Reliure
 * marketplace owns, and the single Mission its "Présenter mon livre" button
 * opens. Same reasoning as the Deck ids above — a `public_token` is a
 * shareable, non-sensitive identifier, so it is safe to commit and stable
 * enough to hardcode in the marketplace's own landing page.
 */
export const BOOKBINDING_WORKSPACE_ID = "00000000-0000-4000-8000-000000000010";
export const BOOKBINDING_PLAYBOOK_ID = "00000000-0000-4000-8000-000000000011";
export const BOOKBINDING_MISSION_ID = "00000000-0000-4000-8000-000000000012";
export const BOOKBINDING_PUBLIC_TOKEN = "reliure-marketplace-token-000001";

/**
 * Fine Bindery's own Mission — the same Playbook, the same workspace, a
 * second Mission (§10 : "réutiliser le moteur Ma Reliure, ne créer aucun
 * moteur parallèle"). Its own `public_token` and `mission_id` are what let
 * the ingestion trigger tell which brand a submitted book belongs to
 * (`marketplace_intake_missions.brand`), and its own `proposal.defaultLocale`
 * (seedFineBinderyMission.ts) is what renders the engine's own chrome in
 * English — the Playbook's authored question labels stay French pending
 * Phase D's translation layer.
 */
export const FINE_BINDERY_MISSION_ID = "00000000-0000-4000-8000-000000000013";
export const FINE_BINDERY_PUBLIC_TOKEN = "fine-bindery-intake-token-000001";
