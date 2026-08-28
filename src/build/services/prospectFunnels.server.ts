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
 *   build_workspace_members     which agent created the funnel (email)
 *
 * `items` carries every funnel loaded so the admin can consult each one;
 * `recent` is the same list truncated for the summary strip. There is one read
 * and one derivation, so the two can never disagree.
 *
 * Kept out of the server-function module on purpose: that file must stay a thin
 * wrapper of `createServerFn` declarations.
 */
import type { Supa } from "./adminAuth.server";
import { prospectDisplayName, prospectDomain } from "@/build/workspaces/internalSales";

export type ProspectFunnelRow = {
  id: string;
  prospectName: string;
  companyName: string | null;
  domain: string | null;
  websiteUrl: string | null;
  /** `prospect_status` on the onboarding row: draft / ready / sent / archived. */
  status: string;
  /** Where the setup wizard stands: started / analyzed / confirmed / published. */
  setupStatus: string;
  detectedBusinessType: string | null;
  confirmedProduct: string | null;
  missionId: string | null;
  missionName: string | null;
  missionStatus: string | null;
  publicToken: string | null;
  /** `/m/<token>` when the demo is published and its link is still live. */
  publicPath: string | null;
  publicLinkActive: boolean;
  createdAt: string;
  createdByEmail: string | null;
  lastViewedAt: string | null;
  funnel: { viewed: number; started: number; completed: number; briefs: number };
};

export type ProspectDemosStats = {
  totals: {
    funnels: number;
    draft: number;
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
  /** Every funnel loaded — the admin consults the list, not a top 10. */
  items: ProspectFunnelRow[];
  recent: ProspectFunnelRow[];
};

const EMPTY: ProspectDemosStats = {
  totals: {
    funnels: 0,
    draft: 0,
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
  items: [],
  recent: [],
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
      "id, workspace_id, mission_id, created_by, status, prospect_company_name, prospect_status, confirmed_business_type, confirmed_product, site_url, final_url, created_at",
    )
    .in("workspace_id", workspaceIds)
    .order("created_at", { ascending: false });

  const rows = onboardings ?? [];
  if (rows.length === 0) return EMPTY;

  const missionIds = rows.map((r) => r.mission_id).filter((id): id is string => Boolean(id));

  const [missionsRes, viewsRes, sessionsRes, briefsRes, membersRes] = await Promise.all([
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
    // Who built the demo. `created_by` is a user id; the email already lives on
    // the membership row, so nothing new has to be stored to name the agent.
    sb.from("build_workspace_members").select("user_id, email").in("workspace_id", workspaceIds),
  ]);

  const missions = new Map(
    (missionsRes.data ?? []).map((m: Record<string, unknown>) => [m['id'] as string, m]),
  );

  const emailByUser = new Map<string, string>();
  for (const m of membersRes.data ?? []) {
    if (m.user_id && m.email) emailByUser.set(m.user_id, m.email);
  }

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

  const items: ProspectFunnelRow[] = rows.map((r) => {
    const mission = r.mission_id ? missions.get(r.mission_id) : undefined;
    const publicToken = (mission?.['public_token'] as string | null) ?? null;
    const revoked = Boolean(mission?.['public_token_revoked_at']);
    const view = publicToken ? viewsByToken.get(publicToken) : undefined;
    const session = r.mission_id ? sessionsByMission.get(r.mission_id) : undefined;
    const briefs = r.mission_id ? (briefsByMission.get(r.mission_id) ?? 0) : 0;
    return {
      id: r.id,
      prospectName: prospectDisplayName(r.prospect_company_name, r.final_url ?? r.site_url),
      companyName: r.prospect_company_name ?? null,
      domain: prospectDomain(r.final_url ?? r.site_url),
      websiteUrl: r.final_url ?? r.site_url ?? null,
      status: r.prospect_status,
      setupStatus: r.status,
      detectedBusinessType: r.confirmed_business_type ?? null,
      confirmedProduct: r.confirmed_product ?? null,
      missionId: r.mission_id ?? null,
      missionName: (mission?.['name'] as string | null) ?? null,
      missionStatus: (mission?.['status'] as string | null) ?? null,
      publicToken,
      publicPath: publicToken ? `/m/${publicToken}` : null,
      publicLinkActive: Boolean(publicToken) && !revoked,
      createdAt: r.created_at,
      createdByEmail: r.created_by ? (emailByUser.get(r.created_by) ?? null) : null,
      lastViewedAt: view?.last ?? null,
      funnel: {
        viewed: view?.count ?? 0,
        started: session?.total ?? 0,
        completed: session?.submitted ?? 0,
        briefs,
      },
    };
  });

  const sum = (pick: (f: ProspectFunnelRow) => number) =>
    items.reduce((total, f) => total + pick(f), 0);
  const views = sum((f) => f.funnel.viewed);
  const sessions = sum((f) => f.funnel.started);
  const briefs = sum((f) => f.funnel.briefs);
  const withStatus = (status: string) => items.filter((f) => f.status === status).length;

  return {
    totals: {
      funnels: items.length,
      draft: withStatus("draft"),
      ready: withStatus("ready"),
      sent: withStatus("sent"),
      archived: withStatus("archived"),
      views,
      sessions,
      submittedSessions: sum((f) => f.funnel.completed),
      briefs,
      viewToStartRate: rate(sessions, views),
      startToBriefRate: rate(briefs, sessions),
    },
    items,
    recent: items.slice(0, 10),
  };
}
