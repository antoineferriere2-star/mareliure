import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getSuperAdminOverview } from "@/build/services/superadmin.data.functions";

export const Route = createFileRoute("/_authenticated/build/activity")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Activité — Super Admin Métré Build AI" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ActivityPage,
  pendingComponent: () => (
    <div className="space-y-3" aria-busy="true">
      <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
      <div className="h-32 w-full animate-pulse rounded-lg bg-muted" />
      <div className="h-64 w-full animate-pulse rounded-lg bg-muted" />
    </div>
  ),
  errorComponent: ({ error }) => (
    <div
      role="alert"
      className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive"
    >
      <p className="font-medium">Impossible de charger l'activité.</p>
      <p className="mt-1 text-xs">{error instanceof Error ? error.message : "Erreur inconnue."}</p>
    </div>
  ),
});

function Card({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

const SERIES = [
  { key: "signups", label: "Inscriptions", className: "bg-primary" },
  { key: "sessions", label: "Sessions", className: "bg-sky-500" },
  { key: "dossiers", label: "Dossiers", className: "bg-emerald-500" },
  { key: "requests", label: "Demandes", className: "bg-amber-500" },
] as const;

function Chart({ series }: { series: Record<string, string | number>[] }) {
  const max = Math.max(
    1,
    ...series.flatMap((row) => SERIES.map((s) => Number(row[s.key] ?? 0))),
  );
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap gap-3">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${s.className}`} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="flex h-40 items-end gap-[3px] overflow-x-auto">
        {series.map((row) => (
          <div key={String(row.day)} className="flex min-w-[10px] flex-1 flex-col justify-end">
            <div className="flex h-40 items-end gap-[1px]" title={String(row.day)}>
              {SERIES.map((s) => {
                const v = Number(row[s.key] ?? 0);
                return (
                  <div
                    key={s.key}
                    className={`w-full rounded-t-sm ${s.className} ${v === 0 ? "opacity-20" : ""}`}
                    style={{ height: `${Math.max(2, (v / max) * 100)}%` }}
                  />
                );
              })}
            </div>
            <span className="mt-1 truncate text-center text-[9px] text-muted-foreground">
              {String(row.day).slice(8)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityPage() {
  const fetchOverview = useServerFn(getSuperAdminOverview);
  const [days, setDays] = useState(30);
  const opts = queryOptions({
    queryKey: ["build-admin", "superadmin-activity", days] as const,
    queryFn: () => fetchOverview({ data: { days } }),
  });
  const { data } = useSuspenseQuery(opts);
  const t = data.totals;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Super Admin · Activité</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Inscriptions, activité produit et fréquentation des surfaces publiques sur les{" "}
            {data.days} derniers jours.
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {[7, 14, 30, 90].map((d) => (
            <option key={d} value={d}>
              {d} jours
            </option>
          ))}
        </select>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          label="Comptes"
          value={t.accounts}
          sub={`+${t.newAccounts} sur la période · ${t.unconfirmedAccounts} non confirmés`}
        />
        <Card
          label="Espaces Client"
          value={t.workspaces}
          sub={`${t.workspaceMembers} membres · ${t.admins} admin`}
        />
        <Card
          label="Fréquentation"
          value={t.sessions}
          sub={`${t.uniqueVisitors} visiteurs uniques`}
        />
        <Card
          label="Taux de complétion"
          value={`${t.conversionRate}%`}
          sub={`${t.submittedSessions} soumises · ${t.dossiers} Dossiers`}
        />
      </div>

      <Chart series={data.series} />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Dernières inscriptions</h2>
          <ul className="mt-3 divide-y divide-border">
            {data.recentAccounts.length === 0 && (
              <li className="py-2 text-xs text-muted-foreground">Aucun compte.</li>
            )}
            {data.recentAccounts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                <div className="min-w-0">
                  <p className="truncate text-foreground">{a.email ?? a.id.slice(0, 8)}</p>
                  <p className="text-muted-foreground">
                    {new Date(a.created_at).toLocaleString()}
                    {a.last_sign_in_at
                      ? ` · dernière connexion ${new Date(a.last_sign_in_at).toLocaleDateString()}`
                      : " · jamais connecté"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {a.role && (
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                      {a.role}
                    </span>
                  )}
                  {!a.confirmed && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] uppercase text-amber-800">
                      non confirmé
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Missions les plus fréquentées</h2>
          <ul className="mt-3 divide-y divide-border">
            {data.topMissions.length === 0 && (
              <li className="py-2 text-xs text-muted-foreground">
                Aucune session sur la période.
              </li>
            )}
            {data.topMissions.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                <span className="min-w-0 truncate text-foreground">{m.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {m.sessions} sessions · {m.dossiers} Dossiers
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">
            Demandes publiques par page d'origine
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {Object.entries(data.requestsByType)
              .map(([k, v]) => `${k} : ${v}`)
              .join(" · ") || "Aucune demande."}
          </p>
          <ul className="mt-3 divide-y divide-border">
            {data.requestsBySource.map((s) => (
              <li key={s.source} className="flex justify-between py-2 text-xs">
                <span className="truncate text-foreground">{s.source}</span>
                <span className="text-muted-foreground">{s.count}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Activité par Espace Client</h2>
          <ul className="mt-3 divide-y divide-border">
            {data.workspaceActivity.length === 0 && (
              <li className="py-2 text-xs text-muted-foreground">Aucun Espace Client.</li>
            )}
            {data.workspaceActivity.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                <span className="min-w-0 truncate text-foreground">{w.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {w.plan}
                  {w.subscriptionStatus ? ` (${w.subscriptionStatus})` : ""} · {w.members} membres ·{" "}
                  {w.dossiers} Dossiers
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">Dernières demandes publiques</h2>
        <ul className="mt-3 divide-y divide-border">
          {data.recentRequests.length === 0 && (
            <li className="py-2 text-xs text-muted-foreground">Aucune demande sur la période.</li>
          )}
          {data.recentRequests.map((r) => (
            <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2 text-xs">
              <span className="text-foreground">
                {r.type} · {r.source}
              </span>
              <span className="text-muted-foreground">
                {r.status} · {new Date(r.created_at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
