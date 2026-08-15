// Server functions for Métré Sales / Demos (/portal/demos): the agent's list of
// prospect demonstrations, and the two markers that say which prospect a demo
// is for and whether the link has been sent.
//
// Security contract, identical to portal.data.functions.ts:
//  - the caller's identity comes from the validated bearer token
//    (context.userId), never from the request body;
//  - the workspaceId supplied by the browser is only used AFTER
//    assertWorkspaceMember / assertWorkspaceOwner has proven the caller belongs
//    to it, on the caller's own RLS-scoped client;
//  - the service-role client is loaded only after that authorization;
//  - every demo id is re-checked against the workspace before any write, so a
//    guessed id cannot reach another workspace's row.
//
// This is not a CRM and must not grow into one. It answers exactly one
// question — "this demo is for which prospect, and where does it stand?" —
// which is why there is no pipeline, no sequence and no scoring here.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin, type Supa } from "./adminAuth.server";
import { fail } from "./serverError";
import { assertWorkspaceMember, assertWorkspaceOwner } from "./workspaceAuth.server";
import {
  isInternalSales,
  PROSPECT_STATUSES,
  prospectDisplayName,
  prospectDomain,
  type ProspectStatus,
} from "@/build/workspaces/internalSales";

const workspaceInput = z.object({ workspaceId: z.string().uuid() });

export interface ProspectDemo {
  /** The build_workspace_onboarding row: one setup is one demo. */
  id: string;
  prospectName: string;
  companyName: string | null;
  websiteUrl: string | null;
  domain: string | null;
  status: ProspectStatus;
  /** Detected by the site analysis, before the agent corrected it. */
  detectedBusinessType: string | null;
  confirmedProduct: string | null;
  missionId: string | null;
  missionStatus: string | null;
  /** Path only. The caller prepends its own origin — server code has no reliable one. */
  publicPath: string | null;
  createdAt: string;
  createdBy: string;
  funnel: DemoFunnel;
}

/**
 * The four numbers §10 asks for, read from the tables the runtime already
 * writes. No new tracking: `viewed` is the public page-view row the intake
 * shell posts for /m/:token, `started` and `completed` are runtime sessions,
 * and `briefs` are the Project Briefs those sessions produced.
 */
export interface DemoFunnel {
  viewed: number;
  started: number;
  completed: number;
  briefs: number;
}

const EMPTY_FUNNEL: DemoFunnel = { viewed: 0, started: 0, completed: 0, briefs: 0 };

/**
 * Refuses on a customer workspace. 404 rather than 403 for the same reason as
 * assertBillingSurface: this surface does not exist for a client account, and
 * saying "forbidden" would confirm that it exists somewhere.
 */
async function assertInternalSalesWorkspace(sb: Supa, workspaceId: string): Promise<void> {
  const { data: workspace, error } = await sb
    .from("build_workspaces")
    .select("workspace_type")
    .eq("id", workspaceId)
    .maybeSingle();
  if (error) fail(500, error.message);
  if (!workspace || !isInternalSales(workspace.workspace_type)) {
    fail(404, "Not found.");
  }
}

/** Funnel counts for every Mission in one workspace, in four queries rather than four per demo. */
async function funnelByMission(
  sb: Supa,
  missions: { id: string; public_token: string | null }[],
): Promise<Map<string, DemoFunnel>> {
  const byMission = new Map<string, DemoFunnel>();
  if (missions.length === 0) return byMission;
  for (const mission of missions) byMission.set(mission.id, { ...EMPTY_FUNNEL });

  const missionIds = missions.map((m) => m.id);

  const [{ data: sessions, error: sErr }, { data: dossiers, error: dErr }] = await Promise.all([
    sb.from("build_runtime_sessions").select("mission_id, status").in("mission_id", missionIds),
    sb.from("build_dossiers").select("mission_id").in("mission_id", missionIds),
  ]);
  if (sErr) fail(500, sErr.message);
  if (dErr) fail(500, dErr.message);

  for (const session of sessions ?? []) {
    const funnel = byMission.get(session.mission_id);
    if (!funnel) continue;
    funnel.started += 1;
    if (session.status === "submitted") funnel.completed += 1;
  }
  for (const dossier of dossiers ?? []) {
    if (!dossier.mission_id) continue;
    const funnel = byMission.get(dossier.mission_id);
    if (funnel) funnel.briefs += 1;
  }

  // Views are keyed by path, not by mission id — build_page_views is the
  // anonymous public-surface tracker and deliberately stores nothing that
  // identifies a workspace.
  const paths = missions
    .filter((m) => m.public_token)
    .map((m) => ({ missionId: m.id, path: `/m/${m.public_token}` }));
  if (paths.length > 0) {
    const { data: views, error: vErr } = await sb
      .from("build_page_views")
      .select("path")
      .in(
        "path",
        paths.map((p) => p.path),
      );
    if (vErr) fail(500, vErr.message);
    const missionByPath = new Map(paths.map((p) => [p.path, p.missionId]));
    for (const view of views ?? []) {
      const missionId = missionByPath.get(view.path);
      const funnel = missionId ? byMission.get(missionId) : undefined;
      if (funnel) funnel.viewed += 1;
    }
  }

  return byMission;
}

/**
 * Every demo in the workspace, newest first. Readable by any member; the two
 * writes below are owner-only, like every other write in the portal.
 */
export const listProspectDemos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => workspaceInput.parse(data))
  .handler(async ({ context, data }): Promise<ProspectDemo[]> => {
    await assertWorkspaceMember(context.supabase, context.userId, data.workspaceId);
    const sb = await admin();
    await assertInternalSalesWorkspace(sb, data.workspaceId);

    const { data: rows, error } = await sb
      .from("build_workspace_onboarding")
      .select(
        "id, site_url, final_url, analysis, confirmed_product, mission_id, prospect_company_name, prospect_status, created_at, created_by",
      )
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) fail(500, error.message);

    const missionIds = [...new Set((rows ?? []).map((r) => r.mission_id).filter(Boolean))];
    const missions = new Map<string, { status: string; public_token: string | null }>();
    let funnels = new Map<string, DemoFunnel>();
    if (missionIds.length > 0) {
      const { data: missionRows, error: mErr } = await sb
        .from("build_missions")
        .select("id, status, public_token, public_token_revoked_at, workspace_id")
        .in("id", missionIds as string[])
        // Defence in depth: the ids came from this workspace's own setups, but
        // a Mission is only ever described here if it is still this workspace's.
        .eq("workspace_id", data.workspaceId);
      if (mErr) fail(500, mErr.message);
      for (const mission of missionRows ?? []) {
        missions.set(mission.id, {
          status: mission.status,
          // A revoked token no longer opens the demo, so the list must not
          // offer it as something to copy.
          public_token: mission.public_token_revoked_at ? null : mission.public_token,
        });
      }
      funnels = await funnelByMission(
        sb,
        (missionRows ?? []).map((m) => ({ id: m.id, public_token: m.public_token })),
      );
    }

    return (rows ?? []).map((row) => {
      const mission = row.mission_id ? missions.get(row.mission_id) : undefined;
      const analysis = (row.analysis ?? null) as { businessType?: unknown } | null;
      return {
        id: row.id,
        prospectName: prospectDisplayName(row.prospect_company_name, row.final_url ?? row.site_url),
        companyName: row.prospect_company_name,
        websiteUrl: row.final_url ?? row.site_url,
        domain: prospectDomain(row.final_url ?? row.site_url),
        status: row.prospect_status as ProspectStatus,
        detectedBusinessType:
          typeof analysis?.businessType === "string" ? analysis.businessType : null,
        confirmedProduct: row.confirmed_product,
        missionId: row.mission_id,
        missionStatus: mission?.status ?? null,
        publicPath: mission?.public_token ? `/m/${mission.public_token}` : null,
        createdAt: row.created_at,
        createdBy: row.created_by,
        funnel: (row.mission_id ? funnels.get(row.mission_id) : undefined) ?? { ...EMPTY_FUNNEL },
      };
    });
  });

/**
 * Names the prospect a demo is for, and moves it along the four statuses.
 * Both fields are optional so the two edits the list offers — rename, mark as
 * sent — go through one function rather than two near-identical ones.
 */
export const updateProspectDemo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    workspaceInput
      .extend({
        demoId: z.string().uuid(),
        companyName: z.string().trim().max(200).nullable().optional(),
        status: z.enum(PROSPECT_STATUSES).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertWorkspaceOwner(context.supabase, context.userId, data.workspaceId);
    const sb = await admin();
    await assertInternalSalesWorkspace(sb, data.workspaceId);

    const { data: demo, error: findError } = await sb
      .from("build_workspace_onboarding")
      .select("id, workspace_id")
      .eq("id", data.demoId)
      .maybeSingle();
    if (findError) fail(500, findError.message);
    if (!demo || demo.workspace_id !== data.workspaceId) fail(404, "Demo not found.");

    const fields: { prospect_company_name?: string | null; prospect_status?: ProspectStatus } = {};
    if (data.companyName !== undefined) {
      fields.prospect_company_name = data.companyName?.trim() ? data.companyName.trim() : null;
    }
    if (data.status !== undefined) fields.prospect_status = data.status;
    if (Object.keys(fields).length === 0) fail(400, "Nothing to update.");

    const { error } = await sb
      .from("build_workspace_onboarding")
      .update(fields)
      .eq("id", data.demoId);
    if (error) fail(500, error.message);
    return { ok: true as const };
  });
