import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getSuperAdminOverview } from "@/build/services/superadmin.data.functions";

export const Route = createFileRoute("/_authenticated/build/activity")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Activity — Super Admin Métré Build AI" },
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
      <p className="font-medium">Unable to load activity.</p>
      <p className="mt-1 text-xs">{error instanceof Error ? error.message : "Unknown error."}</p>
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
  { key: "pageViews", label: "Page views", color: "hsl(243 75% 59%)" },
  { key: "visitors", label: "Unique visitors", color: "hsl(var(--primary))" },
  { key: "sessions", label: "Intake sessions", color: "hsl(199 89% 48%)" },
  { key: "dossiers", label: "Project Briefs", color: "hsl(160 84% 39%)" },
  { key: "requests", label: "Requests", color: "hsl(38 92% 50%)" },
] as const;

const PAGE_COLORS = [
  "hsl(243 75% 59%)",
  "hsl(160 84% 39%)",
  "hsl(38 92% 50%)",
  "hsl(199 89% 48%)",
  "hsl(340 75% 55%)",
];

const W = 720;
const H = 200;
const PAD = { top: 12, right: 12, bottom: 22, left: 34 };

function path(values: number[], max: number) {
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const step = values.length > 1 ? innerW / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = PAD.left + i * step;
      const y = PAD.top + innerH - (v / max) * innerH;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function TrendChart({
  title,
  subtitle,
  rows,
  lines,
}: {
  title: string;
  subtitle?: string;
  rows: Record<string, string | number>[];
  lines: { key: string; label: string; color: string }[];
}) {
  const days = rows.map((r) => String(r.day));
  const max = Math.max(1, ...rows.flatMap((r) => lines.map((l) => Number(r[l.key] ?? 0))));
  const innerH = H - PAD.top - PAD.bottom;
  const ticks = [0, 0.5, 1];
  const labelEvery = Math.ceil(days.length / 10);

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap gap-3">
          {lines.map((l) => (
            <span key={l.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-0.5 w-4 rounded-full" style={{ background: l.color }} />
              <span className="max-w-[160px] truncate">{l.label}</span>
            </span>
          ))}
        </div>
      </div>

      {lines.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">No data over the period.</p>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-3 h-52 w-full"
          role="img"
          aria-label={`${title} trend over ${days.length} days`}
        >
          {ticks.map((t) => {
            const y = PAD.top + innerH - t * innerH;
            return (
              <g key={t}>
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={y}
                  y2={y}
                  stroke="hsl(var(--border))"
                  strokeWidth="1"
                />
                <text x="0" y={y + 3} className="fill-muted-foreground" fontSize="9">
                  {Math.round(max * t)}
                </text>
              </g>
            );
          })}
          {lines.map((l) => {
            const values = rows.map((r) => Number(r[l.key] ?? 0));
            return (
              <path
                key={l.key}
                d={path(values, max)}
                fill="none"
                stroke={l.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}
          {days.map((d, i) => {
            if (i % labelEvery !== 0) return null;
            const innerW = W - PAD.left - PAD.right;
            const step = days.length > 1 ? innerW / (days.length - 1) : 0;
            return (
              <text
                key={d}
                x={PAD.left + i * step}
                y={H - 6}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize="9"
              >
                {d.slice(5)}
              </text>
            );
          })}
        </svg>
      )}
    </section>
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
          <h1 className="text-2xl font-semibold text-foreground">Super Admin · Activity</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Signups, product activity and public-surface traffic over the last {data.days} days.
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {[7, 14, 30, 90].map((d) => (
            <option key={d} value={d}>
              {d} days
            </option>
          ))}
        </select>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          label="Page views"
          value={t.pageViews}
          sub={`${t.viewSessions} visits · ${t.viewsPerVisitor} pages / visitor`}
        />
        <Card
          label="Unique visitors"
          value={t.uniqueViewers}
          sub="Anonymous daily fingerprint, bots excluded"
        />
        <Card
          label="Intake sessions"
          value={t.sessions}
          sub={`${t.uniqueVisitors} unique intake visitors`}
        />
        <Card
          label="Completion rate"
          value={`${t.conversionRate}%`}
          sub={`${t.submittedSessions} submitted · ${t.dossiers} Project Briefs`}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          label="Accounts"
          value={t.accounts}
          sub={`+${t.newAccounts} over the period · ${t.unconfirmedAccounts} unconfirmed`}
        />
        <Card
          label="Client Workspaces"
          value={t.workspaces}
          sub={`${t.workspaceMembers} members · ${t.admins} admin`}
        />
        <Card
          label="Public requests"
          value={t.requests}
          sub={
            Object.entries(data.requestsByType)
              .map(([k, v]) => `${k}: ${v}`)
              .join(" · ") || "No requests"
          }
        />
        <Card
          label="Devices"
          value={data.visits.devices[0]?.device ?? "—"}
          sub={
            data.visits.devices.map((d) => `${d.device}: ${d.count}`).join(" · ") || "No visits yet"
          }
        />
      </div>

      <Chart series={data.series} />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Most visited pages</h2>
          <ul className="mt-3 divide-y divide-border">
            {data.visits.topPages.length === 0 && (
              <li className="py-2 text-xs text-muted-foreground">
                No page views recorded yet over the period.
              </li>
            )}
            {data.visits.topPages.map((p) => (
              <li key={p.path} className="flex justify-between gap-2 py-2 text-xs">
                <span className="min-w-0 truncate text-foreground">{p.path}</span>
                <span className="shrink-0 text-muted-foreground">{p.count} views</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Traffic sources</h2>
          <ul className="mt-3 divide-y divide-border">
            {data.visits.topReferrers.length === 0 && (
              <li className="py-2 text-xs text-muted-foreground">No traffic recorded yet.</li>
            )}
            {data.visits.topReferrers.map((r) => (
              <li key={r.source} className="flex justify-between gap-2 py-2 text-xs">
                <span className="min-w-0 truncate text-foreground">{r.source}</span>
                <span className="shrink-0 text-muted-foreground">{r.count} views</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Languages:{" "}
            {data.visits.locales.map((l) => `${l.locale} (${l.count})`).join(" · ") || "—"}
          </p>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">

        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Latest signups</h2>
          <ul className="mt-3 divide-y divide-border">
            {data.recentAccounts.length === 0 && (
              <li className="py-2 text-xs text-muted-foreground">No accounts.</li>
            )}
            {data.recentAccounts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                <div className="min-w-0">
                  <p className="truncate text-foreground">{a.email ?? a.id.slice(0, 8)}</p>
                  <p className="text-muted-foreground">
                    {new Date(a.created_at).toLocaleString()}
                    {a.last_sign_in_at
                      ? ` · last sign-in ${new Date(a.last_sign_in_at).toLocaleDateString()}`
                      : " · never signed in"}
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
                      unconfirmed
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Most visited Missions</h2>
          <ul className="mt-3 divide-y divide-border">
            {data.topMissions.length === 0 && (
              <li className="py-2 text-xs text-muted-foreground">No sessions over the period.</li>
            )}
            {data.topMissions.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                <span className="min-w-0 truncate text-foreground">{m.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {m.sessions} sessions · {m.dossiers} Project Briefs
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Public requests by source page</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {Object.entries(data.requestsByType)
              .map(([k, v]) => `${k} : ${v}`)
              .join(" · ") || "No requests."}
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
          <h2 className="text-sm font-semibold text-foreground">Activity by Client Workspace</h2>
          <ul className="mt-3 divide-y divide-border">
            {data.workspaceActivity.length === 0 && (
              <li className="py-2 text-xs text-muted-foreground">No Client Workspace.</li>
            )}
            {data.workspaceActivity.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                <span className="min-w-0 truncate text-foreground">{w.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {w.plan}
                  {w.subscriptionStatus ? ` (${w.subscriptionStatus})` : ""} · {w.members} members ·{" "}
                  {w.dossiers} Project Briefs
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">Latest public requests</h2>
        <ul className="mt-3 divide-y divide-border">
          {data.recentRequests.length === 0 && (
            <li className="py-2 text-xs text-muted-foreground">No requests over the period.</li>
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
