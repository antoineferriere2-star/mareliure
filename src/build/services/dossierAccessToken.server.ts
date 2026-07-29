// High-entropy, revisitable access token for a visitor's own Project
// Summary — distinct from build_missions.public_token (shared by every
// visitor of a Mission, revocable but stored raw) and from
// build_runtime_sessions.session_secret_hash (hashed, but tied to a single
// in-progress session with no expiry/revocation). This is the first table
// in the schema combining all three properties: hashed, expiring, and
// independently revocable.
import { createHash, randomBytes } from "crypto";

export const ACCESS_TOKEN_BYTES = 32; // 256 bits — same entropy as session_secret_hash.

// Single place to change the default lifetime. Not a live admin setting
// (nothing else time-boxed in this schema is either, e.g. RATE_LIMIT_WINDOW_MIN
// in build-runtime.ts) — change this constant and redeploy.
export const ACCESS_TOKEN_TTL_DAYS = 90;

export function generateAccessToken(): string {
  return randomBytes(ACCESS_TOKEN_BYTES).toString("hex");
}

/** SHA-256 — the token itself is the sole identifier (unlike session_secret_hash, there is no separate public id to pair it with), so a direct hash-equality lookup is the correct pattern here, mirroring how public_token itself is looked up by direct equality. */
export function hashAccessToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function accessTokenExpiryFromNow(now: Date = new Date()): string {
  return new Date(now.getTime() + ACCESS_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}
