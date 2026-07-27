// Server functions for the Espace Client portal (/portal/*): a workspace
// member's own view of the Dossiers Commerciaux produced by their Missions.
// Never admin-only — gated by workspace membership via assertWorkspaceMember,
// not assertAdmin. Same service-role-client-after-authorization pattern as
// admin.data.functions.ts.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { admin } from "./adminAuth.server";
import { fail } from "./serverError";
import { assertWorkspaceMember, assertWorkspaceOwner } from "./workspaceAuth.server";
import { getWorkspaceUsageInternal } from "./workspaceUsage.server";

const COMMERCIAL_STATUSES = ["nouveau", "contacte", "devise", "gagne", "perdu"] as const;
export type CommercialStatus = (typeof COMMERCIAL_STATUSES)[number];

export const listMyWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await admin();
    const { data: memberships, error } = await sb
      .from("build_workspace_members")
      .select("workspace_id, role")
      .eq("user_id", context.userId);
    if (error) fail(500, error.message);
    if (!memberships || memberships.length === 0) return [];

    const { data: workspaces, error: wErr } = await sb
      .from("build_workspaces")
      .select("id, name")
      .in(
        "id",
        memberships.map((m) => m.workspace_id),
      )
      .eq("is_active", true);
    if (wErr) fail(500, wErr.message);

    const roleByWorkspace = new Map(memberships.map((m) => [m.workspace_id, m.role]));
    return (workspaces ?? []).map((w) => ({ ...w, role: roleByWorkspace.get(w.id) ?? "member" }));
  });

export const listWorkspaceDossiers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertWorkspaceMember(context.supabase, context.userId, data.workspaceId);
    const sb = await admin();
    const { data: dossiers, error } = await sb
      .from("build_dossiers")
      .select("id, summary, commercial_status, mission_id, created_at, last_activity_at")
      .eq("workspace_id", data.workspaceId)
      .order("last_activity_at", { ascending: false })
      .limit(200);
    if (error) fail(500, error.message);
    return dossiers ?? [];
  });

/**
 * Missions belonging to the workspace, with the number of Dossiers each one
 * has produced. Reading is open to any member; pausing/reactivating below is
 * owner-only. Editing the Playbook itself still requires the technical
 * editor and stays admin-only — this is only the on/off switch.
 */
export const listWorkspaceMissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertWorkspaceMember(context.supabase, context.userId, data.workspaceId);
    const sb = await admin();
    const { data: missions, error } = await sb
      .from("build_missions")
      .select("id, name, status, playbook_name, public_token, published_at, created_at")
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) fail(500, error.message);

    const { data: dossiers, error: dErr } = await sb
      .from("build_dossiers")
      .select("mission_id")
      .eq("workspace_id", data.workspaceId)
      .limit(2000);
    if (dErr) fail(500, dErr.message);

    const counts = new Map<string, number>();
    for (const d of dossiers ?? []) {
      if (d.mission_id) counts.set(d.mission_id, (counts.get(d.mission_id) ?? 0) + 1);
    }
    return (missions ?? []).map((m) => ({ ...m, dossierCount: counts.get(m.id) ?? 0 }));
  });

/**
 * Toggles a Mission between active and paused. Never touches build_dossiers
 * — historical Project Briefs stay exactly as they are, this only changes
 * whether the public intake link still accepts new submissions
 * (build-runtime.ts's session-creation path checks Mission status).
 * Owner-only, and the Mission id is always re-verified against
 * workspaceId before any write, so a workspace can never toggle a Mission
 * that belongs to someone else even if it guessed the id.
 */
export const setMissionPaused = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ workspaceId: z.string().uuid(), missionId: z.string().uuid(), paused: z.boolean() })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertWorkspaceOwner(context.supabase, context.userId, data.workspaceId);
    const sb = await admin();

    const { data: mission, error: findError } = await sb
      .from("build_missions")
      .select("id, status, workspace_id")
      .eq("id", data.missionId)
      .maybeSingle();
    if (findError) fail(500, findError.message);
    if (!mission || mission.workspace_id !== data.workspaceId) {
      fail(404, "Mission not found.");
    }
    if (mission.status !== "active" && mission.status !== "paused") {
      fail(400, "Only a published Mission can be paused or reactivated.");
    }

    const { data: updated, error } = await sb
      .from("build_missions")
      .update({ status: data.paused ? "paused" : "active" })
      .eq("id", data.missionId)
      .select("id, status")
      .maybeSingle();
    if (error) fail(500, error.message);
    return updated;
  });

/** Non-blocking usage display for the portal's own workspace — never gates submission. */
export const getMyWorkspaceUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertWorkspaceMember(context.supabase, context.userId, data.workspaceId);
    return getWorkspaceUsageInternal(data.workspaceId);
  });

/** Billing summary for /portal/billing — never returns the raw Stripe customer id, just whether one exists. */
export const getMyWorkspaceBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertWorkspaceMember(context.supabase, context.userId, data.workspaceId);
    const sb = await admin();
    const { data: workspace, error } = await sb
      .from("build_workspaces")
      .select("plan, subscription_status, stripe_customer_id")
      .eq("id", data.workspaceId)
      .maybeSingle();
    if (error) fail(500, error.message);
    if (!workspace) fail(404, "Not found");
    return {
      plan: workspace.plan,
      subscriptionStatus: workspace.subscription_status,
      hasStripeCustomer: workspace.stripe_customer_id !== null,
    };
  });

export const getWorkspaceDossier = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const { data: dossier, error } = await sb
      .from("build_dossiers")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) fail(500, error.message);
    if (!dossier || !dossier.workspace_id) fail(404, "Not found");
    await assertWorkspaceMember(context.supabase, context.userId, dossier.workspace_id);

    let mission: { name: string; playbook_name: string | null } | null = null;
    if (dossier.mission_id) {
      const { data: m } = await sb
        .from("build_missions")
        .select("name, playbook_name")
        .eq("id", dossier.mission_id)
        .maybeSingle();
      mission = m;
    }
    return { dossier, mission };
  });

export const updateDossierFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        commercial_status: z.enum(COMMERCIAL_STATUSES).optional(),
        commercial_notes: z.string().max(5000).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const { data: existing, error: fetchError } = await sb
      .from("build_dossiers")
      .select("workspace_id")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchError) fail(500, fetchError.message);
    if (!existing || !existing.workspace_id) fail(404, "Not found");
    await assertWorkspaceMember(context.supabase, context.userId, existing.workspace_id);

    const { data: updated, error } = await sb
      .from("build_dossiers")
      .update({
        ...(data.commercial_status !== undefined
          ? { commercial_status: data.commercial_status }
          : {}),
        ...(data.commercial_notes !== undefined ? { commercial_notes: data.commercial_notes } : {}),
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("*")
      .maybeSingle();
    if (error) fail(500, error.message);
    if (!updated) fail(404, "Not found");
    return updated;
  });
