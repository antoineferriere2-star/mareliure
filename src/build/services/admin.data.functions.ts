import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Supa = SupabaseClient<Database>;

async function assertAdmin(supabase: Supa, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Response("Forbidden", { status: 403 });
}

export const getBuildDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const [missions, activeMissions, dossiers, audits, betas, sessions] = await Promise.all([
      supabase.from("build_missions").select("id", { count: "exact", head: true }),
      supabase.from("build_missions").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("build_dossiers").select("id", { count: "exact", head: true }),
      supabase.from("build_public_requests").select("id", { count: "exact", head: true }).eq("request_type", "audit"),
      supabase.from("build_public_requests").select("id", { count: "exact", head: true }).eq("request_type", "private_beta"),
      supabase.from("build_runtime_sessions").select("id", { count: "exact", head: true }),
    ]);

    const { data: recentDossiers } = await supabase
      .from("build_dossiers")
      .select("id, status, mission_id, summary, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: recentRequests } = await supabase
      .from("build_public_requests")
      .select("id, request_type, source_path, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    return {
      counts: {
        missions: missions.count ?? 0,
        activeMissions: activeMissions.count ?? 0,
        dossiers: dossiers.count ?? 0,
        audits: audits.count ?? 0,
        betas: betas.count ?? 0,
        sessions: sessions.count ?? 0,
      },
      recentDossiers: recentDossiers ?? [],
      recentRequests: recentRequests ?? [],
    };
  });

export const listBuildMissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("build_missions")
      .select("id, name, status, playbook_name, playbook_id, public_token, published_at, created_at, updated_at, objective")
      .order("created_at", { ascending: false });
    if (error) throw new Response(error.message, { status: 500 });
    return data ?? [];
  });

export const getBuildMission = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: mission, error } = await supabase
      .from("build_missions")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    if (!mission) throw new Response("Not found", { status: 404 });
    return mission;
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
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const patch: { status: string; published_at?: string | null; public_token?: string } = { status: data.status };
    if (data.status === "active") {
      const { data: existing } = await supabase
        .from("build_missions")
        .select("public_token, published_at")
        .eq("id", data.id)
        .maybeSingle();
      if (!existing?.public_token) {
        patch.public_token = crypto.randomUUID().replace(/-/g, "");
      }
      if (!existing?.published_at) {
        patch.published_at = new Date().toISOString();
      }
    }
    const { data: updated, error } = await supabase
      .from("build_missions")
      .update(patch)
      .eq("id", data.id)
      .select()
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    return updated;
  });

export const listBuildDossiers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase
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
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: dossier, error } = await supabase
      .from("build_dossiers")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    if (!dossier) throw new Response("Not found", { status: 404 });

    let mission = null;
    if (dossier.mission_id) {
      const { data: m } = await supabase
        .from("build_missions")
        .select("id, name, playbook_name, public_token, status")
        .eq("id", dossier.mission_id)
        .maybeSingle();
      mission = m;
    }
    let session = null;
    if (dossier.session_id) {
      const { data: s } = await supabase
        .from("build_runtime_sessions")
        .select("id, answers, status, submitted_at, created_at")
        .eq("id", dossier.session_id)
        .maybeSingle();
      session = s;
    }
    return { dossier, mission, session };
  });
