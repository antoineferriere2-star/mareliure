import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBuildDashboardStats } from "@/build/services/admin.data.functions";
import { callWithFallback } from "@/build/services/buildAdminClient";
import {
  createHermesProspectFunnels,
  retryHermesProspectFunnel,
} from "@/build/services/hermesProspectFunnels.data.functions";

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
const PROSPECT_FILTERS = ["all", "draft", "ready", "sent", "archived"] as const;
type ProspectFilter = (typeof PROSPECT_FILTERS)[number];

function ProspectFunnelsPanel({ demos }: { demos: Stats["prospectDemos"] }) {
  const c = demos.totals;
  const queryClient = useQueryClient();
  const createFunnels = useServerFn(createHermesProspectFunnels);
  const retryFunnel = useServerFn(retryHermesProspectFunnel);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ProspectFilter>("all");
  const [companyName, setCompanyName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [product, setProduct] = useState("");
  const [campaignId, setCampaignId] = useState("hermes-outbound");
  const [batchText, setBatchText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      const prospects = parseHermesProspects({
        companyName,
        websiteUrl,
        product,
        campaignId,
        batchText,
      });
      if (prospects.length === 0) {
        throw new Error("Add at least one prospect website.");
      }
      return createFunnels({ data: { prospects } });
    },
    onSuccess: async (result) => {
      const published = result.results.filter((r) => r.status === "published").length;
      const existing = result.results.filter((r) => r.status === "existing").length;
      const failed = result.results.filter((r) => r.status === "failed").length;
      setNotice(`${published} published · ${existing} existing · ${failed} failed`);
      setCompanyName("");
      setWebsiteUrl("");
      setProduct("");
      setBatchText("");
      await queryClient.invalidateQueries({ queryKey: dashboardKey });
    },
    onError: (error) => {
      setNotice(error instanceof Error ? error.message : "Unable to create prospect funnel.");
    },
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => retryFunnel({ data: { id } }),
    onSuccess: async (result) => {
      setNotice(
        result.status === "published"
          ? `${result.prospectName} published`
          : `${result.prospectName}: ${result.error ?? result.status}`,
      );
      await queryClient.invalidateQueries({ queryKey: dashboardKey });
    },
    onError: (error) => {
      setNotice(error instanceof Error ? error.message : "Unable to retry prospect funnel.");
    },
  });

  const metrics = [
    { label: "Funnels", value: c.funnels, sub: `${c.ready} ready · ${c.sent} sent` },
    { label: "Archived", value: c.archived, sub: `${c.draft} still draft` },
    { label: "Public views", value: c.views, sub: "on /m/ links" },
    { label: "Sessions", value: c.sessions, sub: `${c.submittedSessions} submitted` },
    { label: "Project Briefs", value: c.briefs, sub: "generated" },
    {
      label: "View → start",
      value: `${c.viewToStartRate}%`,
      sub: `start → Brief ${c.startToBriefRate}%`,
    },
  ];

  // Every funnel is consultable here, so the list needs its own search rather
  // than a top-10 cut: an agent looks for one prospect by whatever they recall.
  const needle = search.trim().toLowerCase();
  const visible = demos.items.filter((f) => {
    if (filter !== "all" && f.status !== filter) return false;
    if (!needle) return true;
    return [f.prospectName, f.companyName, f.domain, f.confirmedProduct, f.createdByEmail]
      .filter(Boolean)
      .some((value) => (value as string).toLowerCase().includes(needle));
  });

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

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search prospect, domain, product or creator"
          className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-1.5 text-xs"
          aria-label="Search prospect tunnels"
        />
        <div className="flex flex-wrap gap-1">
          {PROSPECT_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-2.5 py-1 text-[11px] capitalize ${
                filter === f
                  ? "border-foreground bg-foreground text-background"
                  : "border-input bg-background text-muted-foreground hover:bg-accent"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[11px] text-muted-foreground">
          Showing {visible.length} of {demos.items.length} prospect tunnels
        </span>
      </div>

      <form
        className="mt-4 rounded-md border border-border/70 bg-background p-3"
        onSubmit={(event) => {
          event.preventDefault();
          setNotice(null);
          createMutation.mutate();
        }}
      >
        <div className="grid gap-2 md:grid-cols-[1fr_1.2fr_0.8fr_0.8fr_auto]">
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Company"
            className="rounded-md border border-input bg-card px-3 py-2 text-xs"
            aria-label="Prospect company name"
          />
          <input
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://prospect.com"
            className="rounded-md border border-input bg-card px-3 py-2 text-xs"
            aria-label="Prospect website URL"
          />
          <input
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            placeholder="Product, optional"
            className="rounded-md border border-input bg-card px-3 py-2 text-xs"
            aria-label="Prospect product"
          />
          <input
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            placeholder="Campaign"
            className="rounded-md border border-input bg-card px-3 py-2 text-xs"
            aria-label="Prospect campaign"
          />
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-md border border-foreground bg-foreground px-3 py-2 text-xs font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
          >
            {createMutation.isPending ? "Creating…" : "Create + publish"}
          </button>
        </div>
        <textarea
          value={batchText}
          onChange={(e) => setBatchText(e.target.value)}
          placeholder="Batch import: Company, Website, Product, Campaign — one prospect per line"
          className="mt-2 min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-xs"
          aria-label="Hermes prospect batch import"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span>
            Hermes can use the internal API too: POST /api/internal/hermes/prospect-funnels
          </span>
          {notice ? <span className="font-medium text-foreground">{notice}</span> : null}
        </div>
      </form>

      {demos.items.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">No prospect funnel yet.</p>
      ) : visible.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">No tunnel matches this search.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="pb-2 pr-3 font-medium">Prospect</th>
                <th className="pb-2 pr-3 font-medium">Status</th>
                <th className="pb-2 pr-3 font-medium">Setup</th>
                <th className="pb-2 pr-3 font-medium">Tunnel</th>
                <th className="pb-2 pr-3 font-medium">Funnel</th>
                <th className="pb-2 pr-3 font-medium">Last activity</th>
                <th className="pb-2 pr-3 font-medium">Created</th>
                <th className="pb-2 pr-3 font-medium">Campaign</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((f) => (
                <tr key={f.id} className="border-t border-border/60 align-top">
                  <td className="py-2 pr-3">
                    <div className="font-medium text-foreground">{f.prospectName}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {f.domain ?? "no site"}
                      {f.confirmedProduct ? ` · ${f.confirmedProduct}` : ""}
                      {f.detectedBusinessType ? ` · ${f.detectedBusinessType}` : ""}
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                      {f.status}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {f.setupStatus}
                    {f.issue ? (
                      <div className="mt-1 text-[11px] text-amber-700">{f.issue}</div>
                    ) : (
                      <div className="mt-1 text-[11px] text-emerald-700">Published, no blocker</div>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    {f.publicPath ? (
                      <a
                        href={f.publicPath}
                        target="_blank"
                        rel="noreferrer"
                        className="text-foreground underline underline-offset-2"
                      >
                        {f.publicLinkActive ? "Open public link" : "Revoked link"}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">Not published</span>
                    )}
                    {f.missionId ? (
                      <div className="mt-0.5">
                        <Link
                          to="/build/missions/$id"
                          params={{ id: f.missionId }}
                          className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
                        >
                          {f.missionName ?? "Project Intake"}
                          {f.missionStatus ? ` · ${f.missionStatus}` : ""}
                        </Link>
                      </div>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {f.funnel.viewed} views · {f.funnel.started} starts · {f.funnel.completed}{" "}
                    submitted · {f.funnel.briefs} Briefs
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {new Date(f.lastActivityAt).toLocaleString()}
                    <div className="text-[11px]">
                      last view: {f.lastViewedAt ? new Date(f.lastViewedAt).toLocaleString() : "—"}
                    </div>
                  </td>
                  <td className="py-2 text-muted-foreground">
                    {new Date(f.createdAt).toLocaleDateString()}
                    {f.createdByEmail ? (
                      <div className="text-[11px]">{f.createdByEmail}</div>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {f.campaignId ?? "—"}
                    {f.lastErrorAt ? (
                      <div className="text-[11px]">
                        failed: {new Date(f.lastErrorAt).toLocaleString()}
                      </div>
                    ) : null}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      {f.publicPath ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (f.publicPath) copyPublicPath(f.publicPath);
                          }}
                          className="rounded-md border border-input px-2 py-1 text-[11px] text-foreground hover:bg-accent"
                        >
                          Copy link
                        </button>
                      ) : null}
                      {f.issue ? (
                        <button
                          type="button"
                          onClick={() => retryMutation.mutate(f.id)}
                          disabled={retryMutation.isPending}
                          className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Retry
                        </button>
                      ) : null}
                    </div>
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

function newProspectRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `hermes-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function splitProspectLine(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map((part) => part.trim());
  if (line.includes(";")) return line.split(";").map((part) => part.trim());
  return line.split(",").map((part) => part.trim());
}

function parseHermesProspects(fields: {
  companyName: string;
  websiteUrl: string;
  product: string;
  campaignId: string;
  batchText: string;
}) {
  const campaignId = fields.campaignId.trim() || null;
  const singleWebsite = fields.websiteUrl.trim();
  if (!fields.batchText.trim()) {
    return singleWebsite
      ? [
          {
            companyName: fields.companyName.trim() || null,
            websiteUrl: singleWebsite,
            product: fields.product.trim() || null,
            campaignId,
            requestId: newProspectRequestId(),
          },
        ]
      : [];
  }

  return fields.batchText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [companyName, websiteUrl, product, lineCampaign] = splitProspectLine(line);
      return {
        companyName: companyName || null,
        websiteUrl: websiteUrl ?? "",
        product: product || fields.product.trim() || null,
        campaignId: lineCampaign || campaignId,
        requestId: newProspectRequestId(),
      };
    })
    .filter((prospect) => prospect.websiteUrl);
}

function copyPublicPath(path: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://metre-pro.com";
  void navigator.clipboard?.writeText(`${origin}${path}`);
}
