import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { z } from "zod";

const MAX_BODY_BYTES = 32 * 1024; // 32 KB
const RATE_LIMIT_WINDOW_MIN = 60;
const RATE_LIMIT_MAX = 60;
const PUBLISHED_STATUS = "active";

const missionRef = {
  mission_id: z.string().uuid().optional(),
  public_token: z.string().min(16).max(160).optional(),
};
const hasRef = (v: { mission_id?: string; public_token?: string }) =>
  Boolean(v.mission_id || v.public_token);

const bodySchema = z.union([
  z.object({ action: z.literal("get_mission"), ...missionRef }).refine(hasRef, "mission_id or public_token required"),
  z.object({ action: z.literal("start_session"), ...missionRef }).refine(hasRef, "mission_id or public_token required"),
  z.object({
    action: z.literal("save_session"),
    session_id: z.string().uuid(),
    answers: z.record(z.string(), z.unknown()),
  }),
  z.object({
    action: z.literal("submit_session"),
    session_id: z.string().uuid(),
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

async function findPublishedMission(
  supabase: any,
  ref: { mission_id?: string; public_token?: string },
) {
  let q = supabase.from("build_missions").select("*").eq("status", PUBLISHED_STATUS);
  if (ref.public_token) {
    q = q.eq("public_token", ref.public_token).is("public_token_revoked_at", null);
  } else {
    q = q.eq("id", ref.mission_id!);
  }
  return q.maybeSingle();
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
          if (body.action === "get_mission") {
            const { data, error } = await findPublishedMission(supabaseAdmin, body);
            if (error) throw error;
            if (!data) return json(404, { error: "Mission not found or not published" });
            return json(200, { mission: publicMission(data) });
          }

          if (body.action === "start_session") {
            const { data: mission, error: mErr } = await findPublishedMission(supabaseAdmin, body);
            if (mErr) throw mErr;
            if (!mission) return json(404, { error: "Mission not available" });
            const { data, error } = await supabaseAdmin
              .from("build_runtime_sessions")
              .insert({ mission_id: mission.id, ip_hash: ipHash, status: "in_progress" })
              .select("id, mission_id, status, answers, created_at")
              .single();
            if (error) throw error;
            return json(200, { mission: publicMission(mission), session: data });
          }

          if (body.action === "save_session") {
            const { data, error } = await supabaseAdmin
              .from("build_runtime_sessions")
              .update({ answers: body.answers as any })
              .eq("id", body.session_id)
              .eq("status", "in_progress")
              .select("id, answers, status")
              .maybeSingle();
            if (error) throw error;
            if (!data) return json(404, { error: "Session not found" });
            return json(200, { session: data });
          }

          if (body.action === "submit_session") {
            const finalAnswers = body.answers;
            const update: {
              status: string;
              submitted_at: string;
              answers?: unknown;
            } = {
              status: "submitted",
              submitted_at: new Date().toISOString(),
            };
            if (finalAnswers) update.answers = finalAnswers;

            const { data: session, error: sErr } = await supabaseAdmin
              .from("build_runtime_sessions")
              .update(update as any)
              .eq("id", body.session_id)
              .select("id, mission_id, answers")
              .maybeSingle();
            if (sErr) throw sErr;
            if (!session) return json(404, { error: "Session not found" });

            const { data: mission } = await supabaseAdmin
              .from("build_missions")
              .select("*")
              .eq("id", session.mission_id)
              .maybeSingle();

            const missing = nextQuestions(mission, session.answers as Record<string, unknown>);
            const dossierStatus = missing.length ? "draft" : "ready";
            const summary = missing.length
              ? `Draft dossier — ${missing.length} follow-up question${missing.length > 1 ? "s" : ""} pending.`
              : "Complete dossier ready for commercial review.";

            const { data: dossier, error: dErr } = await supabaseAdmin
              .from("build_dossiers")
              .insert({
                workspace_id: mission?.workspace_id ?? null,
                mission_id: session.mission_id,
                session_id: session.id,
                status: dossierStatus,
                summary,
                content: {
                  mission_name: mission?.name,
                  objective: mission?.objective,
                  answers: session.answers,
                },
                next_questions: missing,
              })
              .select("id, status, summary, next_questions")
              .single();
            if (dErr) throw dErr;
            return json(200, { dossier });
          }

          return json(400, { error: "Unknown action" });
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
