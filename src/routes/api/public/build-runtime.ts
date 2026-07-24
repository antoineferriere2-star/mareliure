import { createFileRoute } from "@tanstack/react-router";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { generateProjectBrief } from "@/build/engine/brief";
import { computeVisibleSteps, validateField, validateFieldFormat } from "@/build/engine/validation";
import type { Answers, AnswerValue } from "@/build/schema/answers";
import { playbookSchema, type PlaybookField, type PlaybookSchema } from "@/build/schema/playbook";

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
    action: z.literal("resume_session"),
    session_id: z.string().uuid(),
    session_secret: z.string().min(32).max(256),
  }),
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

function findFieldByKey(schema: PlaybookSchema, key: string): PlaybookField | undefined {
  for (const section of schema.sections) {
    for (const step of section.steps) {
      const field = step.fields.find((f) => f.key === key);
      if (field) return field;
    }
  }
  return undefined;
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

async function loadPlaybookSchema(supabase: Supa, playbookVersionId: string): Promise<PlaybookSchema | null> {
  const { data, error } = await supabase
    .from("build_playbook_versions")
    .select("schema")
    .eq("id", playbookVersionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const parsed = playbookSchema.safeParse(data.schema);
  return parsed.success ? parsed.data : null;
}

export async function handleGetMission(supabase: Supa, publicToken: string) {
  const { data, error } = await findPublishedMission(supabase, publicToken);
  if (error) throw error;
  if (!data) return json(404, { error: "Mission not found or not published" });
  if (!data.playbook_version_id) return json(404, { error: "Mission has no published playbook" });
  const schema = await loadPlaybookSchema(supabase, data.playbook_version_id as string);
  if (!schema) return json(500, { error: "Playbook schema unavailable" });
  return json(200, { mission: publicMission(data), playbook_schema: schema });
}

export async function handleStartSession(supabase: Supa, publicToken: string, ipHash: string) {
  const { data: mission, error: mErr } = await findPublishedMission(supabase, publicToken);
  if (mErr) throw mErr;
  if (!mission) return json(404, { error: "Mission not available" });
  if (!mission.playbook_version_id) return json(404, { error: "Mission has no published playbook" });
  const schema = await loadPlaybookSchema(supabase, mission.playbook_version_id as string);
  if (!schema) return json(500, { error: "Playbook schema unavailable" });

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
  return json(200, { mission: publicMission(mission), session: data, session_secret: secret, playbook_schema: schema });
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
    .select("id, status, summary, content, next_questions")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function handleResumeSession(supabase: Supa, sessionId: string, secret: string) {
  const session = await verifySessionSecret(supabase, sessionId, secret);
  if (!session) return json(404, { error: "Session not found" });

  const { data: mission, error: mErr } = await supabase
    .from("build_missions")
    .select("*")
    .eq("id", session.mission_id)
    .maybeSingle();
  if (mErr) throw mErr;
  if (!mission || !mission.playbook_version_id) return json(404, { error: "Mission not available" });
  const schema = await loadPlaybookSchema(supabase, mission.playbook_version_id as string);
  if (!schema) return json(500, { error: "Playbook schema unavailable" });

  const sessionPayload = { id: session.id, answers: session.answers, status: session.status };

  if (session.status !== "in_progress") {
    const existing = await findExistingDossier(supabase, sessionId);
    if (existing) {
      return json(200, { mission: publicMission(mission), playbook_schema: schema, session: sessionPayload, dossier: existing });
    }
  }

  return json(200, { mission: publicMission(mission), playbook_schema: schema, session: sessionPayload });
}

export async function handleSaveSession(
  supabase: Supa,
  sessionId: string,
  secret: string,
  answers: Record<string, unknown>,
) {
  const session = await verifySessionSecret(supabase, sessionId, secret);
  if (!session) return json(404, { error: "Session not found" });

  const { data: mission, error: mErr } = await supabase
    .from("build_missions")
    .select("playbook_version_id")
    .eq("id", session.mission_id)
    .maybeSingle();
  if (mErr) throw mErr;
  if (!mission?.playbook_version_id) return json(500, { error: "Mission has no published playbook" });
  const schema = await loadPlaybookSchema(supabase, mission.playbook_version_id as string);
  if (!schema) return json(500, { error: "Playbook schema unavailable" });

  // Partial validation: unknown keys are rejected outright; known keys with a
  // non-empty value must match their field's type/format. Required-ness is a
  // submit-time concern only (an interim autosave may legitimately be blank).
  const fieldErrors: Record<string, string> = {};
  for (const [key, value] of Object.entries(answers)) {
    const field = findFieldByKey(schema, key);
    if (!field) {
      fieldErrors[key] = "Unknown field.";
      continue;
    }
    const blank = value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
    if (blank) continue;
    const error = validateFieldFormat(field, value as AnswerValue);
    if (error) fieldErrors[key] = error;
  }
  if (Object.keys(fieldErrors).length > 0) {
    return json(400, { error: "Invalid answers", fieldErrors });
  }

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

  const { data: mission, error: missionErr } = await supabase
    .from("build_missions")
    .select("*")
    .eq("id", session.mission_id)
    .maybeSingle();
  if (missionErr) throw missionErr;
  if (!mission?.playbook_version_id) return json(500, { error: "Mission has no published playbook" });
  const schema = await loadPlaybookSchema(supabase, mission.playbook_version_id as string);
  if (!schema) return json(500, { error: "Playbook schema unavailable" });

  const finalAnswers = (answers ?? (session.answers as Record<string, unknown>) ?? {}) as Answers;

  // Full validation: every currently-visible field must satisfy its own
  // rules (required, not-sure, format) before a Dossier can be created.
  const fieldErrors: Record<string, string> = {};
  for (const { visibleFields } of computeVisibleSteps(schema, finalAnswers)) {
    for (const field of visibleFields) {
      const error = validateField(field, finalAnswers[field.key]);
      if (error) fieldErrors[field.key] = error;
    }
  }
  if (Object.keys(fieldErrors).length > 0) {
    return json(422, { error: "Some required information is missing or invalid.", fieldErrors });
  }

  const update: { status: string; submitted_at: string; answers?: Json } = {
    status: "submitted",
    submitted_at: new Date().toISOString(),
  };
  if (answers) update.answers = finalAnswers as unknown as Json;

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

  const brief = generateProjectBrief(schema, updatedSession.answers as Answers, mission);
  const missingCount = brief.missingInformation.length;
  const dossierStatus = missingCount > 0 ? "draft" : "ready";
  const summary =
    missingCount > 0
      ? `Draft dossier — ${missingCount} follow-up item${missingCount > 1 ? "s" : ""} pending.`
      : "Complete dossier ready for commercial review.";

  const { data: dossier, error: dErr } = await supabase
    .from("build_dossiers")
    .insert({
      workspace_id: mission.workspace_id ?? null,
      mission_id: updatedSession.mission_id,
      session_id: updatedSession.id,
      status: dossierStatus,
      summary,
      content: brief as unknown as Json,
      next_questions: brief.missingInformation.map((line) => line.label),
    })
    .select("id, status, summary, content, next_questions")
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
            case "resume_session":
              return await handleResumeSession(supabaseAdmin, body.session_id, body.session_secret);
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
