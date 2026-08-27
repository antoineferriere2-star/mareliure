/**
 * Hermès prospect funnels — the read side of Métré Sales / Demos.
 *
 * A "funnel" is one `build_workspace_onboarding` row inside an `internal_sales`
 * workspace: the prospect's site was analysed, a Playbook draft generated, and
 * (once published) a Mission with a public token created. Nothing here is new
 * data — every number below is counted from tables the runtime already writes:
 *
 *   build_workspace_onboarding  the funnel itself (prospect, site, status)
 *   build_missions              the published Project Intake + its public token
 *   build_page_views            public views, matched on `/m/:public_token`
 *   build_runtime_sessions      sessions started / submitted
 *   build_dossiers              Project Briefs produced
 *
 * Kept out of the server-function module on purpose: that file must stay a thin
 * wrapper of `createServerFn` declarations.
 */
import type { Supa } from "./adminAuth.server";
import { prospectDisplayName, prospectDomain } from "@/build/workspaces/internalSales";

export type ProspectFunnelRow = {
  id: string;
  prospect: string;
  domain: string | null;
  siteUrl: string | null;
  status: string;
  missionId: string | null;
  missionName: string | null;
  missionStatus: string | null;
  publicToken: string | null;
  publicLinkActive: boolean;
  views: number;
  sessions: number;
  submittedSessions: number;
  briefs: number;
  lastViewAt: string | null;
  createdAt: string;
};

export type ProspectDemosStats = {
  counts: {
    funnels: number;
    ready: number;
    sent: number;
    archived: number;
    views: number;
    sessions: number;
    submittedSessions: number;
    briefs: number;
    viewToStartRate: number;
    startToBriefRate: number;
  };
  recentFunnels: ProspectFunnelRow[];
};

const EMPTY: ProspectDemosStats = {
  counts: {
    funnels: 0,
    ready: 0,
    sent: 0,
    archived: 0,
    views: 0,
    sessions: 0,
    submittedSessions: 0,
    briefs: 0,
    viewToStartRate: 0,
    startToBriefRate: 0,
  },
  recentFunnels: [],
};

function rate(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

/**
 * @param workspaceIds ids of the `internal_sales` workspaces, already resolved
 *   by the caller's `internalSalesScope` so there is one definition of
 *   "internal" and no second query keyed on anything else.
 */
export async function readProspectDemos(
  sb: Supa,
  workspaceIds: string[],
): Promise<ProspectDemosStats> {
  if (workspaceIds.length === 0) return EMPTY;

  const { data: onboardings } = await sb
    .from("build_workspace_onboarding")
    .select(
      "id, workspace_id, mission_id, prospect_company_name, prospect_status, site_url, final_url, created_at",
    )
    .in("workspace_id", workspaceIds)
    .order("created_at", { ascending: false });

  const rows = onboardings ?? [];
  if (rows.length === 0) return EMPTY;

  const missionIds = rows.map((r) => r.mission_id).filter((id): id is string => Boolean(id));

  const [missionsRes, viewsRes, sessionsRes, briefsRes] = await Promise.all([
    missionIds.length > 0
      ? sb
          .from("build_missions")
          .select("id, name, status, public_token, public_token_revoked_at")
          .in("id", missionIds)
      : Promise.resolve({ data: [] as never[] }),
    // Public views are recorded by path, so tokens are the join key here.
    sb
      .from("build_page_views")
      .select("path, created_at")
      .like("path", "/m/%")
      .order("created_at", { ascending: false }),
    missionIds.length > 0
      ? sb.from("build_runtime_sessions").select("mission_id, status").in("mission_id", missionIds)
      : Promise.resolve({ data: [] as never[] }),
    missionIds.length > 0
      ? sb.from("build_dossiers").select("mission_id").in("mission_id", missionIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const missions = new Map(
    (missionsRes.data ?? []).map((m: Record<string, unknown>) => [m['id'] as string, m]),
  );

  const viewsByToken = new Map<string, { count: number; last: string }>();
  for (const v of viewsRes.data ?? []) {
    const token = v.path.slice("/m/".length).split(/[/?#]/)[0];
    if (!token) continue;
    const seen = viewsByToken.get(token);
    if (seen) seen.count += 1;
    else viewsByToken.set(token, { count: 1, last: v.created_at });
  }

  const sessionsByMission = new Map<string, { total: number; submitted: number }>();
  for (const s of sessionsRes.data ?? []) {
    const bucket = sessionsByMission.get(s.mission_id) ?? { total: 0, submitted: 0 };
    bucket.total += 1;
    if (s.status === "submitted") bucket.submitted += 1;
    sessionsByMission.set(s.mission_id, bucket);
  }

  const briefsByMission = new Map<string, number>();
  for (const d of briefsRes.data ?? []) {
    if (!d.mission_id) continue;
    briefsByMission.set(d.mission_id, (briefsByMission.get(d.mission_id) ?? 0) + 1);
  }

  const funnels: ProspectFunnelRow[] = rows.map((r) => {
    const mission = r.mission_id ? missions.get(r.mission_id) : undefined;
    const publicToken = (mission?.['public_token'] as string | null) ?? null;
    const view = publicToken ? viewsByToken.get(publicToken) : undefined;
    const session = r.mission_id ? sessionsByMission.get(r.mission_id) : undefined;
    return {
      id: r.id,
      prospect: prospectDisplayName(r.prospect_company_name, r.final_url ?? r.site_url),
      domain: prospectDomain(r.final_url ?? r.site_url),
      siteUrl: r.final_url ?? r.site_url ?? null,
      status: r.prospect_status,
      missionId: r.mission_id ?? null,
      missionName: (mission?.['name'] as string | null) ?? null,
      missionStatus: (mission?.['status'] as string | null) ?? null,
      publicToken,
      publicLinkActive: Boolean(publicToken) && !mission?.['public_token_revoked_at'],
      views: view?.count ?? 0,
      sessions: session?.total ?? 0,
      submittedSessions: session?.submitted ?? 0,
      briefs: r.mission_id ? (briefsByMission.get(r.mission_id) ?? 0) : 0,
      lastViewAt: view?.last ?? null,
      createdAt: r.created_at,
    };
  });

  const sum = (pick: (f: ProspectFunnelRow) => number) =>
    funnels.reduce((total, f) => total + pick(f), 0);
  const views = sum((f) => f.views);
  const sessions = sum((f) => f.sessions);
  const briefs = sum((f) => f.briefs);

  return {
    counts: {
      funnels: funnels.length,
      ready: funnels.filter((f) => f.status === "ready").length,
      sent: funnels.filter((f) => f.status === "sent").length,
      archived: funnels.filter((f) => f.status === "archived").length,
      views,
      sessions,
      submittedSessions: sum((f) => f.submittedSessions),
      briefs,
      viewToStartRate: rate(sessions, views),
      startToBriefRate: rate(briefs, sessions),
    },
    recentFunnels: funnels.slice(0, 10),
  };
}
