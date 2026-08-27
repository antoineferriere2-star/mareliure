import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBuildDashboardStats } from "@/build/services/admin.data.functions";
import { callWithFallback } from "@/build/services/buildAdminClient";

const dashboardKey = ["build-admin", "dashboard"] as const;

type Stats = Awaited<ReturnType<typeof getBuildDashboardStats>>;
type StatsResult = { data: Stats | null; source: "supabase" | "local-fallback" };

const emptyStats: Stats = {
  dataSource: "supabase",
  counts: {
    missions: 0,
    activeMissions: 0,
    dossiers: 0,
    audits: 0,
    betas: 0,
    sessions: 0,
    submittedSessions: 0,
    conversionRate: 0,
  },
  recentDossiers: [],
  recentRequests: [],
  prospectDemos: {
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
  },
};


export const Route = createFileRoute("/_authenticated/build/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dashboard — Métré Build AI" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { admin } = Route.useRouteContext();
  const router = useRouter();
  const fetchStats = useServerFn(getBuildDashboardStats);

  const opts = queryOptions({
    queryKey: dashboardKey,
    queryFn: async (): Promise<StatsResult> => {
      const res = await callWithFallback<Stats>(
        () => fetchStats(),
        () => emptyStats,
      );
      return { data: res.data, source: res.source };
    },
  });
  const { data: result } = useSuspenseQuery(opts);
  const stats = result.data ?? emptyStats;
  const isFallback = result.source === "local-fallback";

  const cards = [
    {
      label: "Active Missions",
      value: stats.counts.activeMissions,
      sub: `${stats.counts.missions} total`,
    },
    {
      label: "Qualified projects",
      value: stats.counts.dossiers,
      sub: `${stats.counts.sessions} sessions`,
    },
    {
      label: "Audits + Private beta",
      value: stats.counts.audits + stats.counts.betas,
      sub: `${stats.counts.audits} audit · ${stats.counts.betas} beta`,
    },
    {
      label: "Conversion rate",
      value: `${stats.counts.conversionRate}%`,
      sub: `${stats.counts.submittedSessions}/${stats.counts.sessions} submitted`,
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome {admin.email ?? admin.userId}. Métré Build AI operations overview.
          </p>
          <p className="mt-2 text-xs">
            <span className="text-muted-foreground">Data source: </span>
            <span
              className={`rounded-full border px-2 py-0.5 font-medium ${
                isFallback
                  ? "border-amber-300 bg-amber-50 text-amber-800"
                  : "border-emerald-300 bg-emerald-50 text-emerald-800"
              }`}
            >
              {isFallback ? "Local dev fallback" : "Supabase Build admin"}
            </span>
          </p>
        </div>
        <button
          onClick={() => router.invalidate()}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          Refresh
        </button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</div>
            <div className="mt-2 text-3xl font-semibold text-foreground">{c.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{c.sub}</div>
          </div>
        ))}
      </div>

      <ProspectFunnelsPanel demos={stats.prospectDemos} />


      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Latest Project Briefs</h2>
          {stats.recentDossiers.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">No Project Brief yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {stats.recentDossiers.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between border-b border-border/60 pb-2 last:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="truncate text-foreground">{d.summary ?? d.id.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(d.created_at).toLocaleString()}
                    </div>
                  </div>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                    {d.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Latest public requests</h2>
          {stats.recentRequests.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">No public request yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {stats.recentRequests.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between border-b border-border/60 pb-2 last:border-b-0"
                >
                  <Link
                    to="/build/requests/$id"
                    params={{ id: r.id }}
                    className="min-w-0 hover:underline"
                  >
                    <div className="truncate text-foreground">{r.request_type}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.source_path} · {new Date(r.created_at).toLocaleString()}
                    </div>
                  </Link>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                    {r.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * Hermès prospect funnels — the demonstrations our own agents build from a
 * prospect's website. Deliberately a separate panel: these Missions and Project
 * Briefs are excluded from every business metric above, and mixing them into the
 * customer lists would make both readings untrustworthy.
 */
function ProspectFunnelsPanel({ demos }: { demos: Stats["prospectDemos"] }) {
  const c = demos.counts;
  const metrics = [
    { label: "Funnels", value: c.funnels, sub: `${c.ready} ready · ${c.sent} sent` },
    { label: "Archived", value: c.archived, sub: "not being worked" },
    { label: "Public views", value: c.views, sub: "on /m/ links" },
    { label: "Sessions", value: c.sessions, sub: `${c.submittedSessions} submitted` },
    { label: "Project Briefs", value: c.briefs, sub: "generated" },
    {
      label: "View → start",
      value: `${c.viewToStartRate}%`,
      sub: `start → Brief ${c.startToBriefRate}%`,
    },
  ];

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Hermes prospect funnels</h2>
        <span className="text-xs text-muted-foreground">
          Métré Sales / Demos only — excluded from the metrics above
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-md border border-border/70 bg-background p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {m.label}
            </div>
            <div className="mt-1 text-xl font-semibold text-foreground">{m.value}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{m.sub}</div>
          </div>
        ))}
      </div>

      {demos.recentFunnels.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">No prospect funnel yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="pb-2 pr-3 font-medium">Prospect</th>
                <th className="pb-2 pr-3 font-medium">Status</th>
                <th className="pb-2 pr-3 font-medium">Public link</th>
                <th className="pb-2 pr-3 font-medium">Funnel</th>
                <th className="pb-2 font-medium">Last view</th>
              </tr>
            </thead>
            <tbody>
              {demos.recentFunnels.map((f) => (
                <tr key={f.id} className="border-t border-border/60">
                  <td className="py-2 pr-3">
                    <div className="font-medium text-foreground">{f.prospect}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {f.domain ?? "no site"}
                      {f.missionName ? ` · ${f.missionName}` : ""}
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                      {f.status}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    {f.publicToken ? (
                      <a
                        href={`/m/${f.publicToken}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-foreground underline underline-offset-2"
                      >
                        {f.publicLinkActive ? "Open" : "Revoked"}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">Not published</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {f.views} views · {f.sessions} started · {f.submittedSessions} submitted ·{" "}
                    {f.briefs} Briefs
                  </td>
                  <td className="py-2 text-muted-foreground">
                    {f.lastViewAt ? new Date(f.lastViewAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
