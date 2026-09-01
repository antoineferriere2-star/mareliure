/**
 * Hermès read-only gateway — the shape of what an external agent may know about
 * the prospection funnels it created.
 *
 * Hermès has no browser and no admin session: it needs the same numbers the
 * admin reads on `/build/dashboard`, as stable JSON. Nothing here queries
 * anything new — `readProspectDemos` already derives every count from
 * `build_workspace_onboarding`, `build_missions`, `build_page_views`,
 * `build_runtime_sessions` and `build_dossiers`, and this module only scopes,
 * filters and projects it.
 *
 * Two invariants:
 *   - the scope is the `internal_sales` workspaces and nothing else, so a
 *     customer's Project Intake can never leave through this door;
 *   - the projection is explicit, so no column added upstream leaks silently.
 */
import type { Supa } from "./adminAuth.server";
import { fail } from "./serverError";
import { INTERNAL_SALES } from "@/build/workspaces/internalSales";
import { readProspectDemos, type ProspectFunnelRow } from "./prospectFunnels.server";

export type HermesFunnelMetricsFilters = {
  campaignId?: string | null;
  /** `prospect_status`: draft / ready / sent / archived. */
  status?: string | null;
  /** ISO date — keeps funnels whose last activity is at or after it. */
  since?: string | null;
  limit?: number | null;
};

export type HermesFunnelMetric = {
  id: string;
  companyName: string | null;
  prospectName: string;
  domain: string | null;
  websiteUrl: string | null;
  campaignId: string | null;
  requestId: string | null;
  prospectStatus: string;
  setupStatus: string;
  missionId: string | null;
  missionStatus: string | null;
  publicPath: string | null;
  publicLinkActive: boolean;
  createdAt: string;
  lastActivityAt: string;
  lastViewedAt: string | null;
  views: number;
  starts: number;
  submissions: number;
  briefs: number;
  issue: string | null;
  lastStep: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
};

export type HermesFunnelMetricsResponse = {
  summary: {
    funnels: number;
    published: number;
    failed: number;
    draft: number;
    ready: number;
    sent: number;
    archived: number;
    views: number;
    starts: number;
    submissions: number;
    briefs: number;
  };
  funnels: HermesFunnelMetric[];
};

/** Ids of Métré's own Sales / Demos workspaces — the only scope Hermès reads. */
export async function internalSalesWorkspaceIds(sb: Supa): Promise<string[]> {
  const { data, error } = await sb
    .from("build_workspaces")
    .select("id")
    .eq("workspace_type", INTERNAL_SALES);
  if (error) fail(500, error.message);
  return (data ?? []).map((w) => w.id);
}

function project(row: ProspectFunnelRow): HermesFunnelMetric {
  return {
    id: row.id,
    companyName: row.companyName,
    prospectName: row.prospectName,
    domain: row.domain,
    websiteUrl: row.websiteUrl,
    campaignId: row.campaignId,
    requestId: row.requestId,
    prospectStatus: row.status,
    setupStatus: row.setupStatus,
    missionId: row.missionId,
    missionStatus: row.missionStatus,
    publicPath: row.publicPath,
    publicLinkActive: row.publicLinkActive,
    createdAt: row.createdAt,
    lastActivityAt: row.lastActivityAt,
    lastViewedAt: row.lastViewedAt,
    views: row.funnel.viewed,
    starts: row.funnel.started,
    submissions: row.funnel.completed,
    briefs: row.funnel.briefs,
    issue: row.issue,
    lastStep: row.lastStep,
    lastError: row.lastError,
    lastErrorAt: row.lastErrorAt,
  };
}

/** Pure filtering + summing, so the contract can be tested without a database. */
export function summariseHermesFunnels(
  rows: ProspectFunnelRow[],
  filters: HermesFunnelMetricsFilters = {},
): HermesFunnelMetricsResponse {
  const sinceMs = filters.since ? Date.parse(filters.since) : NaN;
  let kept = rows.filter((r) => {
    if (filters.campaignId && r.campaignId !== filters.campaignId) return false;
    if (filters.status && r.status !== filters.status) return false;
    if (!Number.isNaN(sinceMs) && Date.parse(r.lastActivityAt) < sinceMs) return false;
    return true;
  });

  const sum = (pick: (r: ProspectFunnelRow) => number) => kept.reduce((t, r) => t + pick(r), 0);
  const withStatus = (status: string) => kept.filter((r) => r.status === status).length;
  const summary = {
    funnels: kept.length,
    published: kept.filter((r) => r.setupStatus === "published").length,
    failed: kept.filter((r) => r.setupStatus === "failed").length,
    draft: withStatus("draft"),
    ready: withStatus("ready"),
    sent: withStatus("sent"),
    archived: withStatus("archived"),
    views: sum((r) => r.funnel.viewed),
    starts: sum((r) => r.funnel.started),
    submissions: sum((r) => r.funnel.completed),
    briefs: sum((r) => r.funnel.briefs),
  };

  // The summary counts everything that matched; `limit` only truncates the list
  // Hermès reads, so a page size can never distort the totals.
  if (filters.limit && filters.limit > 0) kept = kept.slice(0, filters.limit);
  return { summary, funnels: kept.map(project) };
}

export async function readHermesFunnelMetrics(
  sb: Supa,
  filters: HermesFunnelMetricsFilters = {},
): Promise<HermesFunnelMetricsResponse> {
  const workspaceIds = await internalSalesWorkspaceIds(sb);
  const demos = await readProspectDemos(sb, workspaceIds);
  return summariseHermesFunnels(demos.items, filters);
}
