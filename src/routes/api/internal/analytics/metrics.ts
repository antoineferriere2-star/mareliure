import { createFileRoute } from "@tanstack/react-router";
import { admin } from "@/build/services/adminAuth.server";

// ---------- Auth ----------

function bearerToken(request: Request): string | null {
  const h = request.headers.get("Authorization") ?? request.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m?.[1] ?? null;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------- Helpers ----------

function dayKey(iso: string) { return iso.slice(0, 10); }

function buildSeries(days: number, buckets: Record<string, Record<string, number>>) {
  const out: { day: string; [k: string]: string | number }[] = [];
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today); d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    const row: { day: string; [k: string]: string | number } = { day: key };
    for (const metric of Object.keys(buckets)) row[metric] = buckets[metric][key] ?? 0;
    out.push(row);
  }
  return out;
}

function countBy<T>(rows: T[], get: (r: T) => string | null | undefined) {
  const map: Record<string, number> = {};
  for (const r of rows) { const k = get(r); if (k) map[k] = (map[k] ?? 0) + 1; }
  return map;
}

// ---------- Handler ----------

export async function handleAnalyticsMetrics(request: Request): Promise<Response> {
  const bearer = bearerToken(request);
  const tokens = [
    process.env.METRE_ANALYTICS_TOKEN,
    process.env.HERMES_PROSPECT_FUNNEL_TOKEN,
    process.env.HERMES_ADMIN_READ_TOKEN,
  ].filter(Boolean) as string[];
  if (tokens.length === 0) return json(404, { error: "Not found" });
  if (!bearer || !tokens.includes(bearer)) return json(401, { error: "Unauthorized" });

  const url = new URL(request.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get("days") ?? "30", 10) || 30, 7), 90);

  const sb = await admin();
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));
  const sinceIso = since.toISOString();

  const [sessionsRes, dossiersRes, requestsRes, missionsRes, membersRes, workspacesRes, rolesRes, viewsRes] =
    await Promise.all([
      sb.from("build_runtime_sessions").select("id, mission_id, status, created_at, updated_at, submitted_at, visitor_hash").gte("created_at", sinceIso).order("created_at", { ascending: false }).limit(5000),
      sb.from("build_dossiers").select("id, workspace_id, session_id, commercial_status, created_at").gte("created_at", sinceIso).limit(5000),
      sb.from("build_public_requests").select("id, request_type, source_path, status, created_at").gte("created_at", sinceIso).order("created_at", { ascending: false }).limit(5000),
      sb.from("build_missions").select("id, name, status, workspace_id, public_token, published_at"),
      sb.from("build_workspace_members").select("user_id, workspace_id, role"),
      sb.from("build_workspaces").select("id, name, plan, subscription_status, created_at, workspace_type, is_active, trial_ends_at, stripe_customer_id, stripe_subscription_id, max_active_missions, monthly_brief_quota"),
      sb.from("user_roles").select("user_id, role"),
      sb.from("build_page_views").select("path, referrer_host, device, visitor_hash, session_hash, created_at").gte("created_at", sinceIso).order("created_at", { ascending: false }).limit(20000),
    ]);

  const err = sessionsRes.error || dossiersRes.error || requestsRes.error || missionsRes.error || membersRes.error || workspacesRes.error || rolesRes.error || viewsRes.error;
  if (err) return json(500, { error: err.message });

  const sessions = sessionsRes.data ?? [];
  const dossiers = dossiersRes.data ?? [];
  const requests = requestsRes.data ?? [];
  const missions = missionsRes.data ?? [];
  const members = membersRes.data ?? [];
  const workspaces = workspacesRes.data ?? [];
  const roles = rolesRes.data ?? [];
  const views = viewsRes.data ?? [];

  const missionName = new Map(missions.map((m) => [m.id, m.name]));
  const workspaceName = new Map(workspaces.map((w) => [w.id, w.name]));
  const missionByToken = new Map(
    missions.filter((m) => m.public_token).map((m) => [m.public_token as string, m.name]),
  );

  const uniqueViewers = new Set(views.map((v) => v.visitor_hash).filter(Boolean)).size;
  const viewSessions = new Set(views.map((v) => v.session_hash).filter(Boolean)).size;
  const viewsByDay = countBy(views, (v) => dayKey(v.created_at));
  const uniquePerDay: Record<string, number> = {};
  const seenPerDay = new Map<string, Set<string>>();
  for (const v of views) {
    const key = dayKey(v.created_at);
    if (!v.visitor_hash) continue;
    const set = seenPerDay.get(key) ?? seenPerDay.set(key, new Set()).get(key)!;
    set.add(v.visitor_hash);
  }
  for (const [key, set] of seenPerDay) uniquePerDay[key] = set.size;

  const topPages = Object.entries(countBy(views, (v) => v.path))
    .map(([p, c]) => ({ path: p, label: p.startsWith("/m/") ? `Intake · ${missionByToken.get(p.slice(3).split("/")[0]) ?? "unknown"}` : p, count: c }))
    .sort((a, b) => b.count - a.count).slice(0, 12);
  const topReferrers = Object.entries(countBy(views, (v) => v.referrer_host ?? "direct"))
    .map(([s, c]) => ({ source: s, count: c })).sort((a, b) => b.count - a.count).slice(0, 8);

  const series = buildSeries(days, {
    pageViews: viewsByDay, visitors: uniquePerDay,
    dossiers: countBy(dossiers, (d) => dayKey(d.created_at)),
    requests: countBy(requests, (r) => dayKey(r.created_at)),
  });

  const submitted = sessions.filter((s) => s.status === "submitted").length;
  const startedSessions = sessions.filter((s) => s.updated_at && s.created_at && s.updated_at > s.created_at).length;
  const sessionIds = new Set(sessions.map((s) => s.id));
  const dossiersFromPeriod = dossiers.filter((d) => d.session_id && sessionIds.has(d.session_id)).length;

  const funnel = [
    { key: "visitors", label: "Unique visitors (page views)", value: uniqueViewers },
    { key: "opened", label: "Intake opened", value: sessions.length },
    { key: "started", label: "Started answering", value: startedSessions },
    { key: "submitted", label: "Submitted", value: submitted },
    { key: "briefs", label: "Project Briefs", value: dossiersFromPeriod },
  ];

  const planPrices: Record<string, number> = { launch: 1999, growth: 5900, pro: 14900, business: 29900, enterprise: 0 };
  const activeSubs = workspaces.filter((w) => w.subscription_status === "active");
  const trialingSubs = workspaces.filter((w) => w.subscription_status === "trialing");
  const pastDue = workspaces.filter((w) => w.subscription_status === "past_due");
  const canceledSubs = workspaces.filter((w) => ["canceled", "unpaid", "incomplete_expired"].includes(w.subscription_status ?? ""));

  const byPlan: Record<string, number> = {};
  for (const w of activeSubs) { const p = w.plan ?? "unknown"; byPlan[p] = (byPlan[p] ?? 0) + 1; }
  const mrrCents = activeSubs.reduce((s, w) => s + (planPrices[w.plan ?? ""] ?? 0), 0);
  const mrrLost = canceledSubs.filter((w) => w.subscription_status === "canceled" && w.plan)
    .reduce((s, w) => s + (planPrices[w.plan ?? ""] ?? 0), 0);

  const workspaceActivity = workspaces
    .filter((w) => w.workspace_type !== "internal_sales")
    .map((w) => ({
      id: w.id, name: w.name, plan: w.plan, subscriptionStatus: w.subscription_status,
      isActive: w.is_active, hasStripe: !!w.stripe_subscription_id,
      members: members.filter((m) => m.workspace_id === w.id).length,
      dossiers: dossiers.filter((d) => d.workspace_id === w.id).length,
      createdAt: w.created_at,
    }))
    .sort((a, b) => b.dossiers - a.dossiers);

  const inactivePaying = activeSubs.filter((w) => dossiers.filter((d) => d.workspace_id === w.id).length === 0);
  const pricingViews = views.filter((v) => v.path && (/\/pricing|\/tarifs/i).test(v.path)).length;
  const demoViews = views.filter((v) => v.path && (/\/demo|\/request-demo/i).test(v.path)).length;
  const freeAnalysisViews = views.filter((v) => v.path && (/\/analyze|\/free-analysis/i).test(v.path)).length;

  return json(200, {
    generatedAt: new Date().toISOString(),
    days,
    totals: {
      workspaces: workspaces.length, workspaceMembers: members.length, admins: roles.filter((r) => r.role === "admin").length,
      pageViews: views.length, uniqueViewers, viewSessions,
      sessions: sessions.length, startedSessions, submittedSessions: submitted,
      dossiers: dossiers.length, dossiersFromPeriod,
      completionRate: startedSessions ? Math.round(submitted / startedSessions * 100) : 0,
      openedToSubmittedRate: sessions.length ? Math.round(submitted / sessions.length * 100) : 0,
      requests: requests.length,
      pricingViews, demoViews, freeAnalysisViews,
    },
    funnel,
    series,
    visits: { topPages, topReferrers },
    subscriptions: {
      activeSubscriptions: activeSubs.length, trialing: trialingSubs.length,
      pastDue: pastDue.length, canceled: canceledSubs.length,
      totalPaidOrTrial: activeSubs.length + trialingSubs.length + pastDue.length,
      byPlan, mrrCents, mrrUsd: Math.round(mrrCents / 100 * 100) / 100,
      mrrLostCents: mrrLost, mrrLostUsd: Math.round(mrrLost / 100 * 100) / 100,
      avgRevenuePerAccount: activeSubs.length ? Math.round((mrrCents / activeSubs.length) / 100 * 100) / 100 : 0,
      inactivePayingCustomers: inactivePaying.length,
    },
    workspaceActivity: workspaceActivity.slice(0, 20),
    requestsByType: countBy(requests, (r) => r.request_type as string),
  });
}

export const Route = createFileRoute("/api/internal/analytics/metrics")({
  server: { handlers: { GET: async ({ request }) => handleAnalyticsMetrics(request) } },
});