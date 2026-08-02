import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { z } from "zod";
import { logOperationalError } from "@/build/services/operationalLog.server";

/**
 * Insights Engine — real visit tracking for the public surface.
 * Records one anonymous row per page view (no raw IP, no cookies): the path,
 * the referring host, the locale, the device class and a salted per-day
 * visitor fingerprint so unique visitors can be counted without identifying
 * anyone. Consumed read-only by the Super Admin activity dashboard.
 */

const MAX_BODY_BYTES = 2 * 1024;

const bodySchema = z.object({
  path: z.string().trim().min(1).max(500),
  referrer: z.string().trim().max(500).optional().default(""),
  locale: z.string().trim().max(12).optional().default(""),
  sessionHash: z.string().trim().min(8).max(64),
  isNewSession: z.boolean().optional().default(false),
});

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? request.headers.get("cf-connecting-ip") ?? "unknown";
}

function visitorFingerprint(request: Request): string {
  const salt = process.env["IP_HASH_SALT"] ?? "metre-build-ai";
  const day = new Date().toISOString().slice(0, 10);
  const ua = request.headers.get("user-agent") ?? "";
  return createHash("sha256").update(`${salt}:${day}:${clientIp(request)}:${ua}`).digest("hex");
}

function deviceClass(request: Request): string {
  const ua = (request.headers.get("user-agent") ?? "").toLowerCase();
  if (/bot|crawl|spider|preview|monitor|lighthouse/.test(ua)) return "bot";
  if (/ipad|tablet/.test(ua)) return "tablet";
  if (/mobi|android|iphone/.test(ua)) return "mobile";
  return "desktop";
}

function referrerHost(referrer: string): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).host.toLowerCase() || null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/public/track-view")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        if (raw.length > MAX_BODY_BYTES) return jsonResponse(413, { error: "Payload too large." });

        let json: unknown;
        try {
          json = JSON.parse(raw);
        } catch {
          return jsonResponse(400, { error: "Invalid JSON body." });
        }

        const parsed = bodySchema.safeParse(json);
        if (!parsed.success) return jsonResponse(400, { error: "Invalid request shape." });

        const device = deviceClass(request);
        // Bots inflate visit counts without ever becoming a Project Brief.
        if (device === "bot") return jsonResponse(202, { ok: true });

        const { path, referrer, locale, sessionHash, isNewSession } = parsed.data;

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.from("build_page_views").insert({
            path: path.slice(0, 500),
            referrer_host: referrerHost(referrer),
            locale: locale || null,
            device,
            visitor_hash: visitorFingerprint(request),
            session_hash: sessionHash,
            is_new_session: isNewSession,
          });
          if (error) throw error;
        } catch (error) {
          logOperationalError("public-track-view.insert-failed", error, { path });
          return jsonResponse(202, { ok: true });
        }

        return jsonResponse(200, { ok: true });
      },
    },
  },
});
