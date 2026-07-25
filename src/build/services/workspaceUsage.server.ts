// Shared usage-counting logic for a workspace's plan quotas, used by both
// admin.data.functions.ts (admin view) and portal.data.functions.ts (the
// workspace's own view). Never blocks anything itself — Project Brief
// volume is a soft/informational limit only (see plans.ts).
import { admin } from "./adminAuth.server";

export interface WorkspaceUsage {
  activeMissions: number;
  maxActiveMissions: number;
  monthlyBriefs: number;
  monthlyBriefQuota: number;
}

export async function getWorkspaceUsageInternal(workspaceId: string): Promise<WorkspaceUsage> {
  const sb = await admin();

  const { data: workspace, error: wErr } = await sb
    .from("build_workspaces")
    .select("max_active_missions, monthly_brief_quota")
    .eq("id", workspaceId)
    .maybeSingle();
  if (wErr) throw new Response(wErr.message, { status: 500 });
  if (!workspace) throw new Response("Not found", { status: 404 });

  const { count: activeMissions, error: mErr } = await sb
    .from("build_missions")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("status", "active");
  if (mErr) throw new Response(mErr.message, { status: 500 });

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count: monthlyBriefs, error: dErr } = await sb
    .from("build_dossiers")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .gte("created_at", startOfMonth.toISOString());
  if (dErr) throw new Response(dErr.message, { status: 500 });

  return {
    activeMissions: activeMissions ?? 0,
    maxActiveMissions: workspace.max_active_missions,
    monthlyBriefs: monthlyBriefs ?? 0,
    monthlyBriefQuota: workspace.monthly_brief_quota,
  };
}
