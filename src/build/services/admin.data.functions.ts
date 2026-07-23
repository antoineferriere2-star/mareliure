import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Supa = SupabaseClient<Database>;

/**
 * Verify the caller is admin using their own RLS-scoped client. Never uses
 * the service-role client for authorization.
 */
async function assertAdmin(supabase: Supa, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Response("Forbidden", { status: 403 });
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// ---------- Dashboard ----------

export const getBuildDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const sb = await admin();

    const [missions, activeMissions, dossiers, audits, betas, sessions, submitted] = await Promise.all([
      sb.from("build_missions").select("id", { count: "exact", head: true }),
      sb.from("build_missions").select("id", { count: "exact", head: true }).eq("status", "active"),
      sb.from("build_dossiers").select("id", { count: "exact", head: true }),
      sb.from("build_public_requests").select("id", { count: "exact", head: true }).eq("request_type", "audit"),
      sb.from("build_public_requests").select("id", { count: "exact", head: true }).eq("request_type", "private_beta"),
      sb.from("build_runtime_sessions").select("id", { count: "exact", head: true }),
      sb.from("build_runtime_sessions").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    ]);

    const totalSessions = sessions.count ?? 0;
    const submittedCount = submitted.count ?? 0;
    const conversionRate = totalSessions > 0 ? Math.round((submittedCount / totalSessions) * 100) : 0;

    const { data: recentDossiers } = await sb
      .from("build_dossiers")
      .select("id, status, mission_id, summary, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: recentRequests } = await sb
      .from("build_public_requests")
      .select("id, request_type, source_path, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    return {
      dataSource: "supabase" as const,
      counts: {
        missions: missions.count ?? 0,
        activeMissions: activeMissions.count ?? 0,
        dossiers: dossiers.count ?? 0,
        audits: audits.count ?? 0,
        betas: betas.count ?? 0,
        sessions: totalSessions,
        submittedSessions: submittedCount,
        conversionRate,
      },
      recentDossiers: recentDossiers ?? [],
      recentRequests: recentRequests ?? [],
    };
  });

// ---------- Missions ----------

export const listBuildMissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data, error } = await sb
      .from("build_missions")
      .select("id, name, status, playbook_name, playbook_id, public_token, public_token_revoked_at, published_at, created_at, updated_at, objective")
      .order("created_at", { ascending: false });
    if (error) throw new Response(error.message, { status: 500 });
    return data ?? [];
  });

export const getBuildMission = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data: mission, error } = await sb
      .from("build_missions")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    if (!mission) throw new Response("Not found", { status: 404 });
    return mission;
  });

export const createBuildMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      name: z.string().min(2).max(200),
      objective: z.string().max(1000).optional().nullable(),
      playbook_id: z.string().uuid().optional().nullable(),
      playbook_name: z.string().max(200).optional().nullable(),
    }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data: inserted, error } = await sb
      .from("build_missions")
      .insert({
        name: data.name,
        objective: data.objective ?? null,
        playbook_id: data.playbook_id ?? null,
        playbook_name: data.playbook_name ?? null,
        status: "draft",
      })
      .select()
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    return inserted;
  });

export const setMissionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["draft", "active", "paused", "archived"]),
    }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const patch: { status: string; published_at?: string | null; public_token?: string } = { status: data.status };
    if (data.status === "active") {
      const { data: existing } = await sb
        .from("build_missions")
        .select("public_token, published_at")
        .eq("id", data.id)
        .maybeSingle();
      if (!existing?.public_token) patch.public_token = crypto.randomUUID().replace(/-/g, "");
      if (!existing?.published_at) patch.published_at = new Date().toISOString();
    }
    const { data: updated, error } = await sb
      .from("build_missions")
      .update(patch)
      .eq("id", data.id)
      .select()
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    return updated;
  });

export const deleteBuildMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { error } = await sb.from("build_missions").delete().eq("id", data.id);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });

// ---------- Dossiers ----------

export const listBuildDossiers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data, error } = await sb
      .from("build_dossiers")
      .select("id, status, summary, mission_id, session_id, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Response(error.message, { status: 500 });
    return data ?? [];
  });

export const getBuildDossier = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data: dossier, error } = await sb
      .from("build_dossiers")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    if (!dossier) throw new Response("Not found", { status: 404 });

    let mission = null;
    if (dossier.mission_id) {
      const { data: m } = await sb
        .from("build_missions")
        .select("id, name, playbook_name, public_token, status")
        .eq("id", dossier.mission_id)
        .maybeSingle();
      mission = m;
    }
    let session = null;
    if (dossier.session_id) {
      const { data: s } = await sb
        .from("build_runtime_sessions")
        .select("id, answers, status, submitted_at, created_at")
        .eq("id", dossier.session_id)
        .maybeSingle();
      session = s;
    }
    return { dossier, mission, session };
  });

// ---------- Playbooks (custom) ----------

const playbookStepSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  why: z.string().max(500).optional().default(""),
});

export const listCustomPlaybooks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data, error } = await sb
      .from("build_playbooks")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Response(error.message, { status: 500 });
    return data ?? [];
  });

export const createCustomPlaybook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      name: z.string().min(2).max(200),
      description: z.string().max(1000).optional().nullable(),
      project_type: z.string().max(100).optional().nullable(),
      version: z.string().max(30).optional(),
      steps: z.array(playbookStepSchema).max(50).optional(),
    }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data: inserted, error } = await sb
      .from("build_playbooks")
      .insert({
        name: data.name,
        description: data.description ?? null,
        project_type: data.project_type ?? null,
        version: data.version ?? "v1",
        steps: data.steps ?? [],
        created_by: context.userId,
      })
      .select()
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    return inserted;
  });

export const deleteCustomPlaybook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { error } = await sb.from("build_playbooks").delete().eq("id", data.id);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });

// ---------- Knowledge notes ----------

const knowledgeStatus = z.enum(["proposed", "approved", "archived"]);

export const listKnowledgeNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data, error } = await sb
      .from("build_knowledge_notes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Response(error.message, { status: 500 });
    return data ?? [];
  });

export const createKnowledgeNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      title: z.string().min(1).max(200),
      content: z.string().max(5000).optional().nullable(),
      tags: z.array(z.string().max(60)).max(20).optional(),
    }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data: inserted, error } = await sb
      .from("build_knowledge_notes")
      .insert({
        title: data.title,
        content: data.content ?? null,
        tags: data.tags ?? [],
        created_by: context.userId,
      })
      .select()
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    return inserted;
  });

export const updateKnowledgeNoteStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), status: knowledgeStatus }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data: updated, error } = await sb
      .from("build_knowledge_notes")
      .update({ status: data.status })
      .eq("id", data.id)
      .select()
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    return updated;
  });

export const deleteKnowledgeNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { error } = await sb.from("build_knowledge_notes").delete().eq("id", data.id);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });
