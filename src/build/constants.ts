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
