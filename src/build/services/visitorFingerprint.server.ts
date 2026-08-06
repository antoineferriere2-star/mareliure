import { createHash } from "crypto";

/**
 * The anonymous visitor fingerprint, in one place because two surfaces have to
 * produce the *identical* value for it to be worth anything: `track-view`
 * records it on every public page view, and `build-runtime` records it when a
 * visitor opens a Guided Project Intake. Because both hash the same inputs with
 * the same salt, the same person browsing the site and then starting an intake
 * lands on the same hash — which is what lets the Activity dashboard say how
 * many *visitors* opened an intake rather than only how many sessions existed.
 *
 * It rotates daily and is salted, so it counts people without identifying
 * anyone and cannot be joined across days. No raw IP is ever stored.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? request.headers.get("cf-connecting-ip") ?? "unknown";
}

export function visitorFingerprint(request: Request): string {
  const salt = process.env["IP_HASH_SALT"] ?? "metre-build-ai";
  const day = new Date().toISOString().slice(0, 10);
  const userAgent = request.headers.get("user-agent") ?? "";
  return createHash("sha256")
    .update(`${salt}:${day}:${clientIp(request)}:${userAgent}`)
    .digest("hex");
}
