import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useId, useRef, useState } from "react";
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

const nf = new Intl.NumberFormat("en-US");

/* ---------------------------------------------------------------- tiles -- */

function Tile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">
        {typeof value === "number" ? nf.format(value) : value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/* --------------------------------------------------------------- funnel -- */

/**
 * The five stages are an ordered sequence, so they wear an ordinal ramp
 * (one hue, darkening) rather than five identities — the colour itself
 * carries the direction of travel. Each row shows what share of the *previous*
 * stage survived, which is the number that tells you where visitors are lost.
 */
function Funnel({ stages }: { stages: { key: string; label: string; value: number }[] }) {
  const top = Math.max(1, stages[0]?.value ?? 1);
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <ol className="space-y-2.5">
        {stages.map((stage, i) => {
          const previous = i === 0 ? null : stages[i - 1]!.value;
          const kept = previous ? Math.round((stage.value / Math.max(1, previous)) * 100) : null;
          return (
            <li key={stage.key}>
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="text-foreground">{stage.label}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {nf.format(stage.value)}
                  {kept !== null && (
                    <span className={kept < 50 ? " text-destructive" : ""}> · {kept}% kept</span>
                  )}
                </span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-muted">
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${Math.max(stage.value > 0 ? 1.5 : 0, (stage.value / top) * 100)}%`,
                    background: `var(--stage-${i + 1})`,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ----------------------------------------------------------- line chart -- */

const W = 720;
const H = 190;
const PAD = { top: 14, right: 14, bottom: 26, left: 38 };
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;

type Row = Record<string, string | number>;
type Line = { key: string; label: string; color: string };

function xFor(i: number, n: number) {
  return PAD.left + (n > 1 ? (i * INNER_W) / (n - 1) : INNER_W / 2);
}
function yFor(v: number, max: number) {
  return PAD.top + INNER_H - (v / max) * INNER_H;
}

/**
 * Two series maximum, deliberately. The previous chart put five on one linear
 * axis: page views peaked at 72 while Project Briefs never left 0–1, so four
 * of the five lines were pinned flat against the axis and unreadable. Series
 * of different magnitudes belong on different charts, never on a second axis.
 */
function LineChart({
  title,
  hint,
  rows,
  lines,
}: {
  title: string;
  hint?: string;
  rows: Row[];
  lines: Line[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const tableId = useId();

  const days = rows.map((r) => String(r.day));
  const max = Math.max(1, ...rows.flatMap((r) => lines.map((l) => Number(r[l.key] ?? 0))));
  const labelEvery = Math.max(1, Math.ceil(days.length / 8));
  const empty = rows.every((r) => lines.every((l) => Number(r[l.key] ?? 0) === 0));

  function pointerIndex(clientX: number) {
    const svg = svgRef.current;
    if (!svg) return null;
    const box = svg.getBoundingClientRect();
    const ratio = ((clientX - box.left) / box.width) * W;
    const i = Math.round(((ratio - PAD.left) / INNER_W) * (days.length - 1));
    return Math.min(days.length - 1, Math.max(0, i));
  }

  const active = hover !== null ? rows[hover] : null;

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {lines.map((l) => (
            <span key={l.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-0.5 w-4 rounded-full" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            aria-expanded={showTable}
            aria-controls={tableId}
            className="rounded-md border border-input px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            {showTable ? "Hide table" : "Table"}
          </button>
        </div>
      </div>

      {empty ? (
        <p className="mt-6 mb-2 text-xs text-muted-foreground">No activity over this period.</p>
      ) : (
        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="mt-3 w-full touch-none"
            role="img"
            aria-label={`${title}: ${lines.map((l) => l.label).join(" and ")} over ${days.length} days`}
            tabIndex={0}
            onMouseMove={(e) => setHover(pointerIndex(e.clientX))}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover((h) => h ?? days.length - 1)}
            onBlur={() => setHover(null)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
              e.preventDefault();
              setHover((h) => {
                const base = h ?? days.length - 1;
                return Math.min(
                  days.length - 1,
                  Math.max(0, base + (e.key === "ArrowLeft" ? -1 : 1)),
                );
              });
            }}
          >
            {[0, 0.5, 1].map((t) => {
              const y = PAD.top + INNER_H - t * INNER_H;
              return (
                <g key={t}>
                  <line
                    x1={PAD.left}
                    x2={W - PAD.right}
                    y1={y}
                    y2={y}
                    stroke="var(--border)"
                    strokeWidth="1"
                  />
                  <text x="0" y={y + 3} className="fill-muted-foreground tabular-nums" fontSize="9">
                    {Math.round(max * t)}
                  </text>
                </g>
              );
            })}

            {hover !== null && (
              <line
                x1={xFor(hover, days.length)}
                x2={xFor(hover, days.length)}
                y1={PAD.top}
                y2={PAD.top + INNER_H}
                stroke="var(--border)"
                strokeWidth="1"
              />
            )}

            {lines.map((l) => (
              <path
                key={l.key}
                d={rows
                  .map(
                    (r, i) =>
                      `${i === 0 ? "M" : "L"}${xFor(i, days.length).toFixed(1)} ${yFor(Number(r[l.key] ?? 0), max).toFixed(1)}`,
                  )
                  .join(" ")}
                fill="none"
                stroke={l.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {hover !== null &&
              lines.map((l) => (
                <circle
                  key={l.key}
                  cx={xFor(hover, days.length)}
                  cy={yFor(Number(rows[hover]![l.key] ?? 0), max)}
                  r="4"
                  fill={l.color}
                  stroke="var(--card)"
                  strokeWidth="2"
                />
              ))}

            {days.map((d, i) =>
              i % labelEvery === 0 ? (
                <text
                  key={d}
                  x={xFor(i, days.length)}
                  y={H - 8}
                  textAnchor="middle"
                  className="fill-muted-foreground tabular-nums"
                  fontSize="9"
                >
                  {d.slice(5)}
                </text>
              ) : null,
            )}
          </svg>

          {active && (
            <div
              role="status"
              className="pointer-events-none absolute top-0 rounded-md border border-border bg-popover px-2 py-1.5 text-xs shadow-sm"
              style={{
                left: `${(xFor(hover!, days.length) / W) * 100}%`,
                transform:
                  hover! > days.length / 2 ? "translateX(calc(-100% - 8px))" : "translateX(8px)",
              }}
            >
              <p className="font-medium text-foreground">{String(active.day)}</p>
              {lines.map((l) => (
                <p key={l.key} className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-0.5 w-3 rounded-full" style={{ background: l.color }} />
                  {l.label}
                  <span className="tabular-nums text-foreground">
                    {nf.format(Number(active[l.key] ?? 0))}
                  </span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {showTable && (
        <div id={tableId} className="mt-3 max-h-64 overflow-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Day</th>
                {lines.map((l) => (
                  <th
                    key={l.key}
                    className="px-2 py-1.5 text-right font-medium text-muted-foreground"
                  >
                    {l.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.day)} className="border-t border-border">
                  <td className="px-2 py-1 text-foreground tabular-nums">{String(r.day)}</td>
                  {lines.map((l) => (
                    <td key={l.key} className="px-2 py-1 text-right text-foreground tabular-nums">
                      {nf.format(Number(r[l.key] ?? 0))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------- bar list -- */

/**
 * Ranked magnitudes. One hue for every bar: the categories here (pages,
 * referrers) have no natural order, so colour would only re-encode the length
 * the bar already shows.
 */
function BarList({
  title,
  hint,
  rows,
  emptyLabel,
}: {
  title: string;
  hint?: string;
  rows: { key: string; label: string; count: number }[];
  emptyLabel: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li key={r.key}>
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="min-w-0 truncate text-foreground" title={r.key}>
                  {r.label}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {nf.format(r.count)}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                <div
                  className="h-1.5 rounded-full"
                  style={{ width: `${(r.count / max) * 100}%`, background: "var(--chart-1)" }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ page -- */

function ActivityPage() {
  const fetchOverview = useServerFn(getSuperAdminOverview);
  const [days, setDays] = useState(30);
  const opts = queryOptions({
    queryKey: ["build-admin", "superadmin-activity", days] as const,
    queryFn: () => fetchOverview({ data: { days } }),
  });
  const { data } = useSuspenseQuery(opts);
  const t = data.totals;
  const topDevice = data.visits.devices[0];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Super Admin · Activity</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything below is scoped to the last {data.days} days.
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          aria-label="Period"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {[7, 14, 30, 90].map((d) => (
            <option key={d} value={d}>
              {d} days
            </option>
          ))}
        </select>
      </header>

      <Section
        title="From visitor to Project Brief"
        hint="Each stage as a share of the one above it. A session is created when the intake page loads, so “opened” counts arrivals, not intent."
      >
        <Funnel stages={data.funnel} />
      </Section>

      <Section title="Audience" hint="Public surface only. Bots excluded, no cookies, no raw IP.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile
            label="Page views"
            value={t.pageViews}
            sub={`${nf.format(t.viewSessions)} visits · ${t.viewsPerVisitor} pages per visitor`}
          />
          <Tile
            label="Unique visitors"
            value={t.uniqueViewers}
            sub="Salted daily fingerprint, rotated every 24 h"
          />
          <Tile
            label="Visits"
            value={t.viewSessions}
            sub="Browsing sessions, not intake sessions"
          />
          <Tile
            label={topDevice ? `Mostly ${topDevice.device}` : "Devices"}
            value={
              topDevice && t.pageViews
                ? `${Math.round((topDevice.count / t.pageViews) * 100)}%`
                : "—"
            }
            sub={
              data.visits.devices.map((d) => `${d.device} ${nf.format(d.count)}`).join(" · ") ||
              "No visits yet"
            }
          />
        </div>

        <LineChart
          title="Traffic"
          hint="Page views against the people behind them."
          rows={data.series}
          lines={[
            { key: "pageViews", label: "Page views", color: "var(--chart-1)" },
            { key: "visitors", label: "Unique visitors", color: "var(--chart-2)" },
          ]}
        />

        <div className="grid gap-3 lg:grid-cols-2">
          <BarList
            title="Most visited pages"
            hint="Intake pages are shown by Mission name, not by public token."
            rows={data.visits.topPages
              .slice(0, 8)
              .map((p) => ({ key: p.path, label: p.label, count: p.count }))}
            emptyLabel="No page views recorded over the period."
          />
          <BarList
            title="Traffic sources"
            hint={`Languages: ${data.visits.locales.map((l) => `${l.locale} (${l.count})`).join(" · ") || "—"}`}
            rows={data.visits.topReferrers.map((r) => ({
              key: r.source,
              label: r.source,
              count: r.count,
            }))}
            emptyLabel="No traffic recorded yet."
          />
        </div>
      </Section>

      <Section title="Guided Project Intake" hint="What visitors did once they reached a Mission.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile
            label="Intakes opened"
            value={t.sessions}
            sub={`${nf.format(t.uniqueVisitors)} unique visitors reached one`}
          />
          <Tile
            label="Started answering"
            value={t.startedSessions}
            sub={`${t.sessions ? Math.round((t.startedSessions / t.sessions) * 100) : 0}% of opened intakes`}
          />
          <Tile
            label="Completion rate"
            value={`${t.completionRate}%`}
            sub={`${nf.format(t.submittedSessions)} of ${nf.format(t.startedSessions)} that started`}
          />
          <Tile
            label="Project Briefs"
            value={t.dossiersFromPeriodSessions}
            sub={`${nf.format(t.dossiers)} created in total, including older sessions`}
          />
        </div>

        <LineChart
          title="Intake activity"
          hint="Opened against submitted, on the day each happened."
          rows={data.series}
          lines={[
            { key: "sessions", label: "Intakes opened", color: "var(--chart-1)" },
            { key: "submitted", label: "Submitted", color: "var(--chart-2)" },
          ]}
        />

        <section className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">Most visited Missions</h3>
          <ul className="mt-3 divide-y divide-border">
            {data.topMissions.length === 0 && (
              <li className="py-2 text-xs text-muted-foreground">No sessions over the period.</li>
            )}
            {data.topMissions.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                <span className="min-w-0 truncate text-foreground">{m.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {nf.format(m.sessions)} opened · {nf.format(m.dossiers)} Project Briefs
                </span>
              </li>
            ))}
          </ul>
        </section>
      </Section>

      <Section title="Platform" hint="Accounts, Client Workspaces and public requests.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Tile
            label="Accounts"
            value={t.accounts}
            sub={`+${nf.format(t.newAccounts)} over the period · ${nf.format(t.unconfirmedAccounts)} unconfirmed`}
          />
          <Tile
            label="Client Workspaces"
            value={t.workspaces}
            sub={`${nf.format(t.workspaceMembers)} members · ${nf.format(t.admins)} admin`}
          />
          <Tile
            label="Public requests"
            value={t.requests}
            sub={
              Object.entries(data.requestsByType)
                .map(([k, v]) => `${k}: ${v}`)
                .join(" · ") || "No requests"
            }
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">Latest signups</h3>
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
            <h3 className="text-sm font-semibold text-foreground">Activity by Client Workspace</h3>
            <ul className="mt-3 divide-y divide-border">
              {data.workspaceActivity.length === 0 && (
                <li className="py-2 text-xs text-muted-foreground">No Client Workspace.</li>
              )}
              {data.workspaceActivity.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                  <span className="min-w-0 truncate text-foreground">{w.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {w.plan}
                    {w.subscriptionStatus ? ` (${w.subscriptionStatus})` : ""} ·{" "}
                    {nf.format(w.members)} members · {nf.format(w.dossiers)} Project Briefs
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <BarList
            title="Requests by source page"
            rows={data.requestsBySource.map((s) => ({
              key: s.source,
              label: s.source,
              count: s.count,
            }))}
            emptyLabel="No requests over the period."
          />

          <section className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">Latest public requests</h3>
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
      </Section>
    </div>
  );
}
