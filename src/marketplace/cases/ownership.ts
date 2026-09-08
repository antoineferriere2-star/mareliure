/**
 * Who owns a case, and how someone becomes its owner.
 *
 * A visitor completes the Reliure intake anonymously — that is the point of
 * the funnel, and it must stay that way. So a case starts with no owner, and
 * ownership is *claimed* afterwards by an authenticated account.
 *
 * Two claims, deliberately unequal:
 *
 * - `access_token` — the visitor presents the secure summary link Métré
 *   already mints for them (`build_dossier_access_tokens`: 256-bit, hashed,
 *   expiring, revocable). Possession of that link is possession of the
 *   Dossier. This is the strong path, and it is the reason no second token
 *   system exists here: Métré already provides the primitive.
 * - `verified_email` — the account's own verified address matches the one the
 *   visitor typed. Weaker, because it rests on the identity provider having
 *   actually verified the address, so it is only ever accepted when the token
 *   says so explicitly, and only on a case nobody owns yet.
 *
 * Once `customer_user_id` is set it is the *only* thing that authorises a
 * customer (see permissions.ts). E-mail stops granting anything.
 *
 * Pure and framework-free: no database, no clock, no JWT library.
 */

export const CLAIM_METHODS = ["access_token", "verified_email"] as const;
export type ClaimMethod = (typeof CLAIM_METHODS)[number];

export interface ClaimDecision {
  /** Whether the caller may end up owning this case. */
  allowed: boolean;
  /** True when they already owned it — the claim is a no-op, not an error. */
  alreadyOwned: boolean;
  /** Why not, for the caller. Empty when allowed. */
  reason?: string;
}

/**
 * Idempotent by design: claiming a case you already own succeeds and changes
 * nothing. Claiming one someone else owns is refused outright — ownership is
 * never transferred by this path, whatever proof is presented. Moving a case
 * between accounts is a support action, not a self-service one.
 */
export function decideClaim(input: {
  currentOwnerId: string | null;
  requesterId: string;
}): ClaimDecision {
  if (input.currentOwnerId === null) {
    return { allowed: true, alreadyOwned: false };
  }
  if (input.currentOwnerId === input.requesterId) {
    return { allowed: true, alreadyOwned: true };
  }
  return {
    allowed: false,
    alreadyOwned: false,
    // Deliberately says nothing about who owns it, or even that the link was
    // valid: a wrong claim must not confirm that a case exists behind it.
    reason: "Ce projet est déjà rattaché à un autre compte.",
  };
}

/** 64 lowercase hex characters — ACCESS_TOKEN_BYTES (32) rendered as hex. */
const RAW_TOKEN = /\b([0-9a-f]{64})\b/;

/**
 * The token, from whatever the customer pasted.
 *
 * People paste the whole e-mail link, not the token. Accepting
 * `https://…/project-summary/<token>` as readily as the bare token is the
 * difference between a feature that works and a support ticket. Returns null
 * for anything that does not contain exactly one token-shaped string.
 */
export function extractAccessToken(input: string): string | null {
  const match = RAW_TOKEN.exec(input.trim().toLowerCase());
  return match ? match[1] : null;
}

/**
 * The account's e-mail, but only when the identity provider states it is
 * verified.
 *
 * Supabase puts the flag in `user_metadata.email_verified`, and some versions
 * also surface it at the top level of the JWT. Both are checked, and anything
 * short of an explicit `true` is treated as unverified — never as "probably
 * fine". If e-mail confirmation is switched off on the project, this returns
 * null for everyone and the e-mail rapprochement simply never happens, which
 * is the correct failure direction: customers fall back to the link they were
 * sent, and nobody inherits a stranger's book.
 */
export function verifiedEmailFromClaims(claims: Record<string, unknown>): string | null {
  const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
  if (!email) return null;

  const metadata =
    claims.user_metadata && typeof claims.user_metadata === "object"
      ? (claims.user_metadata as Record<string, unknown>)
      : {};
  const verified = claims.email_verified === true || metadata.email_verified === true;

  return verified ? email : null;
}
