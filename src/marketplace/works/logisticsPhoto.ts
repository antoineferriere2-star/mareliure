/** Stable within one actor and one observation, including retries after a lost response. */
export async function logisticsPhotoId(scope: string, bytes: Uint8Array): Promise<string> {
  const prefix = new TextEncoder().encode(`logistics-photo-v1:${scope}:`);
  const input = new Uint8Array(prefix.length + bytes.length);
  input.set(prefix);
  input.set(bytes, prefix.length);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", input));
  // UUIDv8, derived from the scope and content rather than a new random request.
  digest[6] = (digest[6] & 15) | 128;
  digest[8] = (digest[8] & 63) | 128;
  const hex = [...digest.slice(0, 16)].map((n) => n.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

/** Never overwrite evidence: a retry must find precisely the originally supplied bytes. */
export function samePhotoBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((byte, index) => byte === right[index]);
}
