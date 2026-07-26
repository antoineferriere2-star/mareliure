import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
import { getPlaybookPublishIssues } from "@/build/engine/validation";
import { playbookSchema } from "@/build/schema/playbook";
import type { ProjectBrief } from "@/build/schema/brief";
import { admin, assertAdmin } from "./adminAuth.server";
import { getWorkspaceUsageInternal } from "./workspaceUsage.server";
import { PLAN_IDS, getPlanDefaults } from "@/build/billing/plans";
import { wouldExceedActiveMissions } from "@/build/billing/quota";
import { resolvePlanColumnsUpdate } from "@/build/billing/planSync";

// ---------- Dashboard ----------

export const getBuildDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const sb = await admin();

    const [missions, activeMissions, dossiers, audits, betas, sessions, submitted] =
      await Promise.all([
        sb.from("build_missions").select("id", { count: "exact", head: true }),
        sb
          .from("build_missions")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        sb.from("build_dossiers").select("id", { count: "exact", head: true }),
        sb
          .from("build_public_requests")
          .select("id", { count: "exact", head: true })
          .eq("request_type", "audit"),
        sb
          .from("build_public_requests")
          .select("id", { count: "exact", head: true })
          .eq("request_type", "private_beta"),
        sb.from("build_runtime_sessions").select("id", { count: "exact", head: true }),
        sb
          .from("build_runtime_sessions")
          .select("id", { count: "exact", head: true })
          .eq("status", "submitted"),
      ]);

    const totalSessions = sessions.count ?? 0;
    const submittedCount = submitted.count ?? 0;
    const conversionRate =
      totalSessions > 0 ? Math.round((submittedCount / totalSessions) * 100) : 0;

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
      .select(
        "id, name, status, playbook_name, playbook_id, playbook_version_id, public_token, public_token_revoked_at, published_at, created_at, updated_at, objective",
      )
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
    z
      .object({
        name: z.string().min(2).max(200),
        objective: z.string().max(1000).optional().nullable(),
        playbook_id: z.string().uuid().optional().nullable(),
        playbook_version_id: z.string().uuid().optional().nullable(),
        playbook_name: z.string().max(200).optional().nullable(),
        workspace_id: z.string().uuid().optional().nullable(),
      })
      .parse(data),
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
        playbook_version_id: data.playbook_version_id ?? null,
        playbook_name: data.playbook_name ?? null,
        workspace_id: data.workspace_id ?? null,
        status: "draft",
      })
      .select()
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    return inserted;
  });

export const setMissionWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), workspace_id: z.string().uuid().nullable() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data: updated, error } = await sb
      .from("build_missions")
      .update({ workspace_id: data.workspace_id })
      .eq("id", data.id)
      .select()
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    if (!updated) throw new Response("Not found", { status: 404 });
    return updated;
  });

export const setMissionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["draft", "active", "paused", "archived"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const patch: { status: string; published_at?: string | null; public_token?: string } = {
      status: data.status,
    };
    if (data.status === "active") {
      const { data: existing } = await sb
        .from("build_missions")
        .select("public_token, published_at, playbook_version_id, workspace_id, status")
        .eq("id", data.id)
        .maybeSingle();
      if (!existing?.playbook_version_id) {
        throw new Response("Cannot activate a mission without a published Playbook version.", {
          status: 400,
        });
      }
      if (existing.workspace_id && existing.status !== "active") {
        const { count: activeCount, error: countError } = await sb
          .from("build_missions")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", existing.workspace_id)
          .eq("status", "active");
        if (countError) throw new Response(countError.message, { status: 500 });
        const { data: workspace, error: wErr } = await sb
          .from("build_workspaces")
          .select("max_active_missions")
          .eq("id", existing.workspace_id)
          .maybeSingle();
        if (wErr) throw new Response(wErr.message, { status: 500 });
        if (
          workspace &&
          wouldExceedActiveMissions(activeCount ?? 0, workspace.max_active_missions)
        ) {
          throw new Response(
            `This workspace has reached its plan's active Mission limit (${workspace.max_active_missions}). Increase the limit or pause another Mission first.`,
            { status: 400 },
          );
        }
      }
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

const INSPIRATION_PHOTOS_BUCKET = "build-inspiration-photos";

/** Signed URL (1h) for an inspiration photo stored during a public session — the bucket is private, admin-only access. */
export const getInspirationPhotoUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ path: z.string().min(1) }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data: signed, error } = await sb.storage
      .from(INSPIRATION_PHOTOS_BUCKET)
      .createSignedUrl(data.path, 3600);
    if (error) throw new Response(error.message, { status: 500 });
    return { url: signed.signedUrl };
  });

/**
 * Admin-triggered AI Engine analysis. Always additive: writes ai_insights +
 * ai_analyzed_at alongside the existing deterministic `content`, never edits
 * or replaces it (CLAUDE.md: "L'IA propose, ne décide jamais"). Never called
 * automatically from the public runtime.
 */
export const analyzeDossierWithAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();

    const { data: dossier, error } = await sb
      .from("build_dossiers")
      .select("id, mission_id, content")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    if (!dossier) throw new Response("Not found", { status: 404 });
    if (!dossier.content) {
      throw new Response("This Dossier has no content to analyze yet.", { status: 400 });
    }

    let mission: { name: string; objective: string | null } = { name: "Mission", objective: null };
    if (dossier.mission_id) {
      const { data: m } = await sb
        .from("build_missions")
        .select("name, objective")
        .eq("id", dossier.mission_id)
        .maybeSingle();
      if (m) mission = m;
    }

    const { data: notes } = await sb
      .from("build_knowledge_notes")
      .select("title, content")
      .eq("status", "approved");

    const { runAiAnalysis } = await import("@/build/ai/runAnalysis");
    const insights = await runAiAnalysis(
      mission,
      dossier.content as unknown as ProjectBrief,
      notes ?? [],
    );

    const { data: updated, error: uErr } = await sb
      .from("build_dossiers")
      .update({
        ai_insights: insights as unknown as Json,
        ai_analyzed_at: insights.generatedAt,
      })
      .eq("id", data.id)
      .select("*")
      .maybeSingle();
    if (uErr) throw new Response(uErr.message, { status: 500 });
    if (!updated) throw new Response("Not found", { status: 404 });
    return updated;
  });

// ---------- Playbooks ----------
//
// A Playbook has a mutable `draft_schema` (edited freely) and an immutable
// `published_version_id` pointer into `build_playbook_versions`. Missions
// pin to one specific published version so editing a draft never changes a
// live Mission's behavior — see supabase/migrations/20260724060000_*.sql.

export const listBuildPlaybooks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data, error } = await sb
      .from("build_playbooks")
      .select(
        "id, name, description, project_type, is_active, published_version_id, created_at, updated_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Response(error.message, { status: 500 });
    return data ?? [];
  });

/** Playbooks with a published version, for the Mission-creation picker. */
export const listPublishablePlaybooks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data, error } = await sb
      .from("build_playbooks")
      .select("id, name, project_type, published_version_id")
      .not("published_version_id", "is", null)
      .eq("is_active", true)
      .order("name", { ascending: true });
    if (error) throw new Response(error.message, { status: 500 });
    return data ?? [];
  });

export const getBuildPlaybook = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data: playbook, error } = await sb
      .from("build_playbooks")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    if (!playbook) throw new Response("Not found", { status: 404 });

    const { data: versions, error: vErr } = await sb
      .from("build_playbook_versions")
      .select("id, version_number, published_at")
      .eq("playbook_id", data.id)
      .order("version_number", { ascending: false });
    if (vErr) throw new Response(vErr.message, { status: 500 });

    return { ...playbook, versions: versions ?? [] };
  });

export const createBuildPlaybook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        name: z.string().min(2).max(200),
        description: z.string().max(1000).optional().nullable(),
        project_type: z.string().max(100).optional().nullable(),
      })
      .parse(data),
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
        created_by: context.userId,
      })
      .select()
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    return inserted;
  });

export const updatePlaybookDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(2).max(200).optional(),
        description: z.string().max(1000).optional().nullable(),
        project_type: z.string().max(100).optional().nullable(),
        is_active: z.boolean().optional(),
        draft_schema: z.unknown(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const parsedSchema = playbookSchema.safeParse(data.draft_schema);
    if (!parsedSchema.success) {
      throw new Response(
        `Invalid playbook schema: ${parsedSchema.error.issues[0]?.message ?? "malformed"}`,
        { status: 400 },
      );
    }
    const sb = await admin();
    const { data: updated, error } = await sb
      .from("build_playbooks")
      .update({
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.project_type !== undefined ? { project_type: data.project_type } : {}),
        ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
        draft_schema: parsedSchema.data as unknown as Json,
      })
      .eq("id", data.id)
      .select()
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    if (!updated) throw new Response("Not found", { status: 404 });
    return updated;
  });

export const publishPlaybookVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();

    const { data: playbook, error } = await sb
      .from("build_playbooks")
      .select("draft_schema")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    if (!playbook) throw new Response("Not found", { status: 404 });

    const parsedSchema = playbookSchema.safeParse(playbook.draft_schema);
    if (!parsedSchema.success) {
      throw new Response("The draft schema is malformed and cannot be published.", { status: 400 });
    }
    const issues = getPlaybookPublishIssues(parsedSchema.data);
    if (issues.length > 0) {
      throw new Response(`Playbook is not ready to publish: ${issues.join(" ")}`, { status: 400 });
    }

    const { data: lastVersion } = await sb
      .from("build_playbook_versions")
      .select("version_number")
      .eq("playbook_id", data.id)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersionNumber = (lastVersion?.version_number ?? 0) + 1;

    const { data: version, error: vErr } = await sb
      .from("build_playbook_versions")
      .insert({
        playbook_id: data.id,
        version_number: nextVersionNumber,
        schema: parsedSchema.data as unknown as Json,
        published_by: context.userId,
      })
      .select("id, version_number, published_at")
      .single();
    if (vErr) throw new Response(vErr.message, { status: 500 });

    const { data: updated, error: pErr } = await sb
      .from("build_playbooks")
      .update({ published_version_id: version.id })
      .eq("id", data.id)
      .select()
      .maybeSingle();
    if (pErr) throw new Response(pErr.message, { status: 500 });

    return { playbook: updated, version };
  });

export const deleteBuildPlaybook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { error } = await sb.from("build_playbooks").delete().eq("id", data.id);
    if (error) {
      if (error.code === "23503") {
        throw new Response("This playbook has live Missions attached and cannot be deleted.", {
          status: 409,
        });
      }
      throw new Response(error.message, { status: 500 });
    }
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
    z
      .object({
        title: z.string().min(1).max(200),
        content: z.string().max(5000).optional().nullable(),
        tags: z.array(z.string().max(60)).max(20).optional(),
      })
      .parse(data),
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

// ---------- Workspaces (Espace Client) ----------
//
// A workspace is a client business account for the /portal/* portal.
// Provisioning is admin-only: no self-signup. Membership is looked up by
// email against Supabase Auth; an unknown email gets a fresh account
// (email pre-confirmed, no password). Clients never set or use a password —
// they sign in on /auth via a magic link / one-time code (signInWithOtp),
// so there is nothing to invite them to click through here.

export const listWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data: workspaces, error } = await sb
      .from("build_workspaces")
      .select("id, name, is_active, plan, max_active_missions, monthly_brief_quota, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Response(error.message, { status: 500 });

    const { data: members, error: mErr } = await sb
      .from("build_workspace_members")
      .select("id, workspace_id, email, role");
    if (mErr) throw new Response(mErr.message, { status: 500 });

    return (workspaces ?? []).map((w) => ({
      ...w,
      members: (members ?? []).filter((m) => m.workspace_id === w.id),
    }));
  });

export const createWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ name: z.string().min(2).max(200), plan: z.enum(PLAN_IDS).optional() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const plan = data.plan ?? "launch";
    const defaults = getPlanDefaults(plan);
    const { data: inserted, error } = await sb
      .from("build_workspaces")
      .insert({
        name: data.name,
        created_by: context.userId,
        plan,
        max_active_missions: defaults.maxActiveMissions ?? 1,
        monthly_brief_quota: defaults.monthlyBriefQuota ?? 50,
      })
      .select()
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    return inserted;
  });

export const updateWorkspacePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        plan: z.enum(PLAN_IDS),
        max_active_missions: z.number().int().min(0).optional(),
        monthly_brief_quota: z.number().int().min(0).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data: updated, error } = await sb
      .from("build_workspaces")
      .update(
        resolvePlanColumnsUpdate(data.plan, {
          max_active_missions: data.max_active_missions,
          monthly_brief_quota: data.monthly_brief_quota,
        }),
      )
      .eq("id", data.workspaceId)
      .select()
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    if (!updated) throw new Response("Not found", { status: 404 });
    return updated;
  });

/** Active-Mission and monthly-Project-Brief usage for a workspace, for the admin usage display. */
export const getWorkspaceUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    return getWorkspaceUsageInternal(data.workspaceId);
  });

export const addWorkspaceMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ workspaceId: z.string().uuid(), email: z.string().email() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const normalizedEmail = data.email.trim().toLowerCase();

    const { data: existingUsers, error: listError } = await sb.auth.admin.listUsers({
      perPage: 1000,
    });
    if (listError) throw new Response(listError.message, { status: 500 });
    let userId = existingUsers.users.find((u) => u.email?.toLowerCase() === normalizedEmail)?.id;

    if (!userId) {
      const { data: created, error: createError } = await sb.auth.admin.createUser({
        email: normalizedEmail,
        email_confirm: true,
      });
      if (createError || !created.user) {
        throw new Response(createError?.message ?? "Impossible de créer ce compte.", {
          status: 500,
        });
      }
      userId = created.user.id;
    }

    const { data: inserted, error } = await sb
      .from("build_workspace_members")
      .insert({ workspace_id: data.workspaceId, user_id: userId, email: normalizedEmail })
      .select()
      .maybeSingle();
    if (error) {
      if (error.code === "23505") {
        throw new Response("Cette personne est déjà membre de cet Espace Client.", { status: 409 });
      }
      throw new Response(error.message, { status: 500 });
    }
    return inserted;
  });

export const removeWorkspaceMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { error } = await sb.from("build_workspace_members").delete().eq("id", data.id);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });
