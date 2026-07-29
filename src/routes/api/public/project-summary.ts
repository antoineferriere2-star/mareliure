// Public, read-only access to a visitor's own Project Summary via a secure,
// high-entropy access token (src/build/services/dossierAccessToken.server.ts)
// - a completely separate security boundary from build-runtime.ts's session
// auth and Mission public_token. Never mutates anything, never returns a
// dossier id, workspace id, mission id, or the internal ProjectBrief.
import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { hashAccessToken, ACCESS_TOKEN_BYTES } from "@/build/services/dossierAccessToken.server";
import { logOperationalError } from "@/build/services/operationalLog.server";

type Supa = SupabaseClient<Database>;

const MAX_BODY_BYTES = 4 * 1024;
const RATE_LIMIT_WINDOW_MIN = 60;
const RATE_LIMIT_MAX = 30;
// Same bucket name as build-runtime.ts / admin.data.functions.ts — kept as
// its own literal here rather than a shared import so this file's trust
// boundary stays self-contained and independently auditable.
const INSPIRATION_PHOTOS_BUCKET = "build-inspiration-photos";

const bodySchema = z.object({
  token: z
    .string()
    .length(ACCESS_TOKEN_BYTES * 2)
    .regex(/^[0-9a-f]+$/),
});

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? request.headers.get("cf-connecting-ip") ?? "unknown";
}

function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? "metre-build-ai";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

// Every failure mode below (unknown token, revoked, expired) returns this
// exact same 404 body — never anything that would let a caller distinguish
// "wrong token" from "right token, but revoked/expired". That distinction
// is only ever visible in the observability event name, server-side.
const NOT_AVAILABLE = { error: "This summary link is not available." };

/**
 * Resolves each photo to a fresh signed URL for public consumption.
 * Deliberately returns ONLY `{ url, caption }` — the storage path and
 * bucket name are server-side implementation details that must never
 * reach a visitor's browser, so they are dropped here rather than passed
 * through and filtered later.
 */
async function resolvePhotoUrls(
  supabase: Supa,
  photos: { path: string; caption?: string }[],
): Promise<{ url: string | null; caption?: string }[]> {
  return Promise.all(
    photos.map(async ({ path, caption }) => {
      const { data, error } = await supabase.storage
        .from(INSPIRATION_PHOTOS_BUCKET)
        .createSignedUrl(path, 3600);
      if (error) {
        logOperationalError("project-summary.photo-sign-failed", error, {});
        return { url: null, caption };
      }
      return { url: data.signedUrl, caption };
    }),
  );
}

export async function handleGetSummary(supabase: Supa, rawToken: string) {
  const tokenHash = hashAccessToken(rawToken);
  const { data: tokenRow, error } = await supabase
    .from("build_dossier_access_tokens")
    .select("id, dossier_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error) throw error;
  if (!tokenRow) return json(404, NOT_AVAILABLE);
  if (tokenRow.revoked_at) return json(404, NOT_AVAILABLE);
  if (tokenRow.expires_at && new Date(tokenRow.expires_at).getTime() < Date.now()) {
    return json(404, NOT_AVAILABLE);
  }

  const { data: dossier, error: dossierError } = await supabase
    .from("build_dossiers")
    .select("visitor_summary")
    .eq("id", tokenRow.dossier_id)
    .maybeSingle();
  if (dossierError) throw dossierError;
  if (!dossier?.visitor_summary) return json(404, NOT_AVAILABLE);

  // Best-effort — never blocks the read.
  await supabase
    .from("build_dossier_access_tokens")
    .update({ last_accessed_at: new Date().toISOString() })
    .eq("id", tokenRow.id);

  const summary = dossier.visitor_summary as {
    photos: { path: string; caption?: string }[];
    [key: string]: unknown;
  };
  const photos = await resolvePhotoUrls(supabase, summary.photos ?? []);

  return json(200, { summary: { ...summary, photos } });
}

export const Route = createFileRoute("/api/public/project-summary")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        if (raw.length > MAX_BODY_BYTES) return json(413, { error: "Payload too large" });

        let parsed;
        try {
          parsed = bodySchema.safeParse(JSON.parse(raw));
        } catch {
          return json(400, { error: "Invalid JSON" });
        }
        if (!parsed.success) return json(404, NOT_AVAILABLE);

        const ipHash = hashIp(clientIp(request));
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MIN * 60 * 1000).toISOString();
        const { count } = await supabaseAdmin
          .from("build_runtime_rate")
          .select("*", { count: "exact", head: true })
          .eq("ip_hash", ipHash)
          .gte("created_at", windowStart);
        if ((count ?? 0) >= RATE_LIMIT_MAX) {
          return json(429, { error: "Too many requests" });
        }
        await supabaseAdmin
          .from("build_runtime_rate")
          .insert({ ip_hash: ipHash, action: "project_summary_view" });

        try {
          return await handleGetSummary(supabaseAdmin, parsed.data.token);
        } catch (err) {
          logOperationalError("project-summary.unhandled-error", err, {});
          return json(500, { error: "Internal error" });
        }
      },
    },
  },
});
