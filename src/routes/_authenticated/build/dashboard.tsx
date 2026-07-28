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
