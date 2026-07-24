// Server-only. Fetches the public HTML of a client-supplied URL for the
// onboarding wizard's site-analysis step. Every check here closes an SSRF
// path — see the plan's "Risques SSRF" section for the full threat model
// and the runtime limitation it works within: Cloudflare Workers exposes no
// dns.lookup/socket-pinning API, so this is hostname/IP-literal validation
// applied on every hop (including redirects), not full DNS-rebinding
// protection. Never import this from client code.
//
// Validation always runs against `new URL(...).hostname`, never the raw
// user-typed string — the WHATWG URL parser already canonicalizes decimal/
// octal/hex IPv4 shorthand (e.g. "2130706433", "0x7f000001") into standard
// dotted-quad form, which is what closes that class of bypass here.

const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0"]);
const BLOCKED_TLD_SUFFIXES = [".local", ".internal", ".localhost"];

function ipv4OctetsBlocked([a, b]: number[]): boolean {
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 0) return true; // "this network"
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a >= 224) return true; // multicast (224-239) + reserved (240-255)
  return false;
}

function isBlockedIpv4(hostname: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!match) return false;
  const octets = match.slice(1, 5).map(Number);
  if (octets.some((n) => n > 255)) return false;
  return ipv4OctetsBlocked(octets);
}

function isBlockedIpv6(hostname: string): boolean {
  if (!hostname.includes(":")) return false;
  if (hostname === "::1") return true; // loopback
  if (hostname.startsWith("fe80:")) return true; // link-local fe80::/10
  if (hostname.startsWith("fc") || hostname.startsWith("fd")) return true; // unique local fc00::/7

  // IPv4-mapped IPv6 (::ffff:a.b.c.d) — the WHATWG URL parser normalizes the
  // embedded IPv4 into two hex groups (e.g. "::ffff:127.0.0.1" becomes
  // "::ffff:7f00:1"), so reconstruct the octets from those groups rather
  // than matching a dotted-quad literal that will never appear here.
  const mappedDotted = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(hostname);
  if (mappedDotted) return isBlockedIpv4(mappedDotted[1]);
  const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(hostname);
  if (mappedHex) {
    const hi = Number.parseInt(mappedHex[1], 16);
    const lo = Number.parseInt(mappedHex[2], 16);
    return ipv4OctetsBlocked([(hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff]);
  }
  return false;
}

function isBlockedHostname(rawHostname: string): boolean {
  const lower = rawHostname.toLowerCase();
  // URL.hostname wraps IPv6 literals in brackets ("[::1]") — strip them
  // before running the IPv4/IPv6 checks below.
  const bare = lower.startsWith("[") && lower.endsWith("]") ? lower.slice(1, -1) : lower;
  if (BLOCKED_HOSTNAMES.has(bare)) return true;
  if (BLOCKED_TLD_SUFFIXES.some((suffix) => bare.endsWith(suffix))) return true;
  if (isBlockedIpv4(bare)) return true;
  if (isBlockedIpv6(bare)) return true;
  return false;
}

export function normalizeOnboardingUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("URL invalide.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Seules les URL http/https sont acceptées.");
  }
  if (isBlockedHostname(url.hostname)) {
    throw new Error("Cette URL pointe vers une adresse non autorisée.");
  }
  return url;
}

const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;

async function fetchOnce(url: URL): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url.toString(), {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: { Accept: "text/html,text/plain;q=0.8" },
    });
  } finally {
    clearTimeout(timer);
  }
}

function concatChunks(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    const take = Math.min(chunk.byteLength, total - offset);
    out.set(chunk.subarray(0, take), offset);
    offset += take;
    if (offset >= total) break;
  }
  return out;
}

async function readCappedBody(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return await response.text();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
      if (total >= MAX_BYTES) {
        await reader.cancel();
        break;
      }
    }
  }
  const capped = Math.min(total, MAX_BYTES);
  return new TextDecoder("utf-8").decode(concatChunks(chunks, capped));
}

export interface FetchedSite {
  finalUrl: string;
  html: string;
}

/**
 * Fetches the public HTML of a client-supplied URL. Redirects are resolved
 * manually so every hop is re-validated against the same SSRF rules as the
 * original URL — a redirect to a private/internal address is rejected
 * exactly like a direct request to it would be.
 */
export async function fetchSitePublicHtml(rawUrl: string): Promise<FetchedSite> {
  let url = normalizeOnboardingUrl(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetchOnce(url);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirection sans destination.");
      if (hop === MAX_REDIRECTS) throw new Error("Trop de redirections.");
      url = normalizeOnboardingUrl(new URL(location, url).toString());
      continue;
    }

    if (!response.ok) {
      throw new Error(`Le site a répondu avec le statut ${response.status}.`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType && !/text\/html|text\/plain/i.test(contentType)) {
      throw new Error("Le contenu de cette URL n'est pas une page web (HTML).");
    }

    const html = await readCappedBody(response);
    return { finalUrl: url.toString(), html };
  }

  throw new Error("Trop de redirections.");
}
