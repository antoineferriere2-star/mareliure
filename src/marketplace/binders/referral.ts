/**
 * An atelier's own referral link — `mareliure.fr/a/:slug` (§52-§56).
 *
 * The slug is deliberately public: it is meant to be shared, printed on a
 * business card, said out loud. Its security property is not secrecy — it is
 * that a client's `acquisition_origin` is decided by *resolving the slug on
 * the server* against the table of approved ateliers, never by trusting
 * anything the visitor's browser asserts directly. Guessing or fabricating a
 * slug gets a visitor nothing beyond what following a real atelier's real
 * link already would.
 *
 * Pure and framework-free, like ownership.ts and membership.ts.
 */

export const ACQUISITION_ORIGINS = ["MA_RELIURE_ACQUIRED", "BINDER_REFERRED"] as const;
export type AcquisitionOrigin = (typeof ACQUISITION_ORIGINS)[number];

/** Matches the CHECK constraint in the schema: lowercase, digits, single hyphens. */
const SLUG_FORMAT = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MIN_SLUG_LENGTH = 3;
const MAX_SLUG_LENGTH = 64;

export function isValidReferralSlug(candidate: string): boolean {
  return (
    candidate.length >= MIN_SLUG_LENGTH &&
    candidate.length <= MAX_SLUG_LENGTH &&
    SLUG_FORMAT.test(candidate)
  );
}

/** A reasonable default from a workshop's own name — the admin may still edit it. */
export function slugify(workshopName: string): string {
  return workshopName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH);
}

/**
 * The reserved answer key a referred session carries through the tunnel.
 *
 * Not a Playbook field — no Mission ever declares it, so the engine ignores
 * it exactly as it ignores any answer key it was not asked about (the same
 * property `visitorEmailFrom` already relies on for the real `email` field).
 * `reconcileCaseTriage` is the only reader, and only once per case.
 */
export const REFERRAL_ANSWER_KEY = "_referral_slug";
