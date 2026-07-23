import { createFileRoute } from "@tanstack/react-router";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

type Supa = SupabaseClient<Database>;

const MAX_BODY_BYTES = 32 * 1024; // 32 KB
const RATE_LIMIT_WINDOW_MIN = 60;
const RATE_LIMIT_MAX = 60;
const PUBLISHED_STATUS = "active";
const SESSION_SECRET_BYTES = 32;

// Public entry point is the shareable public_token ONLY. Raw mission_id must
// never be accepted here — it would let anyone who learns a mission's UUID
// (e.g. from the admin console) bypass a revoked/unshared public link.
export const bodySchema = z.union([
  z.object({ action: z.literal("get_mission"), public_token: z.string().min(16).max(160) }),
  z.object({ action: z.literal("start_session"), public_token: z.string().min(16).max(160) }),
  z.object({
    action: z.literal("save_session"),
    session_id: z.string().uuid(),
    session_secret: z.string().min(32).max(256),
    answers: z.record(z.string(), z.unknown()),
  }),
  z.object({
    action: z.literal("submit_session"),
    session_id: z.string().uuid(),
    session_secret: z.string().min(32).max(256),
    answers: z.record(z.string(), z.unknown()).optional(),
  }),
]);

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? "metre-build-ai";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

function generateSessionSecret(): string {
  return randomBytes(SESSION_SECRET_BYTES).toString("hex");
}

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

// Constant-time comparison so a mistyped/guessed secret can't be distinguished
// from a correct one by response timing.
function secretMatches(storedHash: string, provided: string): boolean {
  const a = Buffer.from(storedHash, "hex");
  const b = Buffer.from(hashSecret(provided), "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function publicMission(m: Record<string, unknown>) {
  return {
    id: m.id,
    name: m.name,
    status: m.status,
    objective: m.objective,
    playbook_id: m.playbook_id,
    playbook_name: m.playbook_name,
    proposal: m.proposal,
  };
}

function nextQuestions(mission: unknown, answers: Record<string, unknown>): string[] {
  const proposal = (mission as { proposal?: { qualificationQuestions?: unknown } } | null)?.proposal;
  const qs = Array.isArray(proposal?.qualificationQuestions)
    ? (proposal!.qualificationQuestions as unknown[]).filter((v): v is string => typeof v === "string")
    : [];
  return qs.filter((_, i) => {
    const key = `q${i}`;
    const v = answers?.[key];
    return v === undefined || v === null || String(v).trim() === "";
  });
}

// Sole public lookup path: must always require an unrevoked token on an
// active mission. Do not add a mission_id-only variant of this query.
export async function findPublishedMission(supabase: Supa, publicToken: string) {
  return supabase
    .from("build_missions")
    .select("*")
    .eq("status", PUBLISHED_STATUS)
    .eq("public_token", publicToken)
    .is("public_token_revoked_at", null)
    .maybeSingle();
}

export async function handleGetMission(supabase: Supa, publicToken: string) {
  const { data, error } = await findPublishedMission(supabase, publicToken);
  if (error) throw error;
  if (!data) return json(404, { error: "Mission not found or not published" });
  return json(200, { mission: publicMission(data) });
}

export async function handleStartSession(supabase: Supa, publicToken: string, ipHash: string) {
  const { data: mission, error: mErr } = await findPublishedMission(supabase, publicToken);
  if (mErr) throw mErr;
  if (!mission) return json(404, { error: "Mission not available" });

  const secret = generateSessionSecret();
  const { data, error } = await supabase
    .from("build_runtime_sessions")
    .insert({
      mission_id: mission.id,
      ip_hash: ipHash,
      status: "in_progress",
      session_secret_hash: hashSecret(secret),
    })
    .select("id, mission_id, status, answers, created_at")
    .single();
  if (error) throw error;
  return json(200, { mission: publicMission(mission), session: data, session_secret: secret });
}

async function loadSessionSecretHash(supabase: Supa, sessionId: string) {
  return supabase
    .from("build_runtime_sessions")
    .select("id, session_secret_hash, status, mission_id, answers")
    .eq("id", sessionId)
    .maybeSingle();
}

// Verifies session_id + session_secret together. Returns the session row only
// when the secret matches; otherwise null (caller responds 404 either way so
// a bad secret can't be distinguished from an unknown session_id).
async function verifySessionSecret(supabase: Supa, sessionId: string, secret: string) {
  const { data, error } = await loadSessionSecretHash(supabase, sessionId);
  if (error) throw error;
  if (!data || !data.session_secret_hash || !secretMatches(data.session_secret_hash, secret)) {
    return null;
  }
  return data;
}

async function findExistingDossier(supabase: Supa, sessionId: string) {
  const { data, error } = await supabase
    .from("build_dossiers")
    .select("id, status, summary, next_questions")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function handleSaveSession(
  supabase: Supa,
  sessionId: string,
  secret: string,
  answers: Record<string, unknown>,
) {
  const session = await verifySessionSecret(supabase, sessionId, secret);
  if (!session) return json(404, { error: "Session not found" });

  const { data, error } = await supabase
    .from("build_runtime_sessions")
    .update({ answers: answers as unknown as Json })
    .eq("id", sessionId)
    .eq("status", "in_progress")
    .select("id, answers, status")
    .maybeSingle();
  if (error) throw error;
  if (!data) return json(409, { error: "Session already submitted" });
  return json(200, { session: data });
}

export async function handleSubmitSession(
  supabase: Supa,
  sessionId: string,
  secret: string,
  answers?: Record<string, unknown>,
) {
  const session = await verifySessionSecret(supabase, sessionId, secret);
  if (!session) return json(404, { error: "Session not found" });

  // Idempotency guard #1: session must still be in_progress to transition.
  // A session that already left in_progress means a previous submit won —
  // return that dossier instead of erroring or creating a second one.
  if (session.status !== "in_progress") {
    const existing = await findExistingDossier(supabase, sessionId);
    if (existing) return json(200, { dossier: existing });
    return json(409, { error: "Session already submitted" });
  }

  const update: { status: string; submitted_at: string; answers?: Json } = {
    status: "submitted",
    submitted_at: new Date().toISOString(),
  };
  if (answers) update.answers = answers as unknown as Json;

  const { data: updatedSession, error: sErr } = await supabase
    .from("build_runtime_sessions")
    .update(update)
    .eq("id", sessionId)
    .eq("status", "in_progress")
    .select("id, mission_id, answers")
    .maybeSingle();
  if (sErr) throw sErr;
  if (!updatedSession) {
    // Lost a race against a concurrent submit for the same session.
    const existing = await findExistingDossier(supabase, sessionId);
    if (existing) return json(200, { dossier: existing });
    return json(409, { error: "Session already submitted" });
  }

  const { data: mission } = await supabase
    .from("build_missions")
    .select("*")
    .eq("id", updatedSession.mission_id)
    .maybeSingle();

  const missing = nextQuestions(mission, updatedSession.answers as Record<string, unknown>);
  const dossierStatus = missing.length ? "draft" : "ready";
  const summary = missing.length
    ? `Draft dossier — ${missing.length} follow-up question${missing.length > 1 ? "s" : ""} pending.`
    : "Complete dossier ready for commercial review.";

  const { data: dossier, error: dErr } = await supabase
    .from("build_dossiers")
    .insert({
      workspace_id: mission?.workspace_id ?? null,
      mission_id: updatedSession.mission_id,
      session_id: updatedSession.id,
      status: dossierStatus,
      summary,
      content: {
        mission_name: mission?.name,
        objective: mission?.objective,
        answers: updatedSession.answers,
      },
      next_questions: missing,
    })
    .select("id, status, summary, next_questions")
    .single();
  if (dErr) {
    // Idempotency guard #2 (belt-and-braces): the unique index on
    // build_dossiers.session_id rejects a second insert outright if two
    // submits ever raced past the status check above.
    if ((dErr as { code?: string }).code === "23505") {
      const existing = await findExistingDossier(supabase, sessionId);
      if (existing) return json(200, { dossier: existing });
    }
    throw dErr;
  }
  return json(200, { dossier });
}

export const Route = createFileRoute("/api/public/build-runtime")({
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
        if (!parsed.success) {
          return json(400, { error: "Invalid body", details: parsed.error.flatten() });
        }
        const body = parsed.data;

        const ipHash = hashIp(clientIp(request));
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Per-IP rate limit
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
          .insert({ ip_hash: ipHash, action: body.action });

        try {
          switch (body.action) {
            case "get_mission":
              return await handleGetMission(supabaseAdmin, body.public_token);
            case "start_session":
              return await handleStartSession(supabaseAdmin, body.public_token, ipHash);
            case "save_session":
              return await handleSaveSession(supabaseAdmin, body.session_id, body.session_secret, body.answers);
            case "submit_session":
              return await handleSubmitSession(supabaseAdmin, body.session_id, body.session_secret, body.answers);
            default:
              return json(400, { error: "Unknown action" });
          }
        } catch (err) {
          console.error("[build-runtime]", err);
          return json(500, {
            error: err instanceof Error ? err.message : "Internal error",
          });
        }
      },
    },
  },
});
