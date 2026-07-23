import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBuildDashboardStats } from "@/build/services/admin.data.functions";

const dashboardKey = ["build-admin", "dashboard"] as const;

export const Route = createFileRoute("/_authenticated/build/dashboard")({
  ssr: false,
  head: () => ({ meta: [{ title: "Dashboard — Métré Build AI" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { admin } = Route.useRouteContext();
  const router = useRouter();
  const fetchStats = useServerFn(getBuildDashboardStats);
  const opts = queryOptions({ queryKey: dashboardKey, queryFn: () => fetchStats() });
  const { data } = useSuspenseQuery(opts);

  const cards = [
    { label: "Missions", value: data.counts.missions, sub: `${data.counts.activeMissions} actives` },
    { label: "Dossiers générés", value: data.counts.dossiers, sub: `${data.counts.sessions} sessions` },
    { label: "Audits reçus", value: data.counts.audits, sub: "demandes /free-inquiry-audit" },
    { label: "Private beta", value: data.counts.betas, sub: "demandes /private-beta" },
  ];

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bienvenue {admin.email ?? admin.userId}. Vue d'ensemble Métré Build AI.
          </p>
        </div>
        <button
          onClick={() => router.invalidate()}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          Actualiser
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
          <h2 className="text-sm font-semibold text-foreground">Derniers dossiers</h2>
          {data.recentDossiers.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">Aucun dossier pour le moment.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {data.recentDossiers.map((d) => (
                <li key={d.id} className="flex items-center justify-between border-b border-border/60 pb-2 last:border-b-0">
                  <div className="min-w-0">
                    <div className="truncate text-foreground">{d.summary ?? d.id.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString()}</div>
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
          <h2 className="text-sm font-semibold text-foreground">Dernières demandes publiques</h2>
          {data.recentRequests.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">Aucune demande pour le moment.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {data.recentRequests.map((r) => (
                <li key={r.id} className="flex items-center justify-between border-b border-border/60 pb-2 last:border-b-0">
                  <div className="min-w-0">
                    <div className="truncate text-foreground">{r.request_type}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.source_path} · {new Date(r.created_at).toLocaleString()}
                    </div>
                  </div>
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
