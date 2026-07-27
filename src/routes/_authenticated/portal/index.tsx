import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  listMyWorkspaces,
  listWorkspaceDossiers,
  getMyWorkspaceUsage,
  type CommercialStatus,
} from "@/build/services/portal.data.functions";
import { usageLevel } from "@/build/billing/quota";
import { PortalError, PortalPending } from "@/build/pages/portal/PortalStates";

export const Route = createFileRoute("/_authenticated/portal/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Mes Dossiers — Espace Client" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  pendingComponent: PortalPending,
  errorComponent: PortalError,
  component: PortalHomePage,
});

const PAGE_SIZE = 25;

type DossierRow = {
  id: string;
  summary: string | null;
  commercial_status: string;
  created_at: string;
  last_activity_at: string;
};

function toCsv(rows: DossierRow[]): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = ["Résumé", "Statut", "Reçu le", "Dernière activité"].map(escape).join(",");
  const body = rows.map((r) =>
    [
      r.summary ?? `Dossier ${r.id.slice(0, 8)}`,
      r.commercial_status,
      new Date(r.created_at).toISOString(),
      new Date(r.last_activity_at).toISOString(),
    ]
      .map(escape)
      .join(","),
  );
  return [header, ...body].join("\n");
}

function downloadCsv(rows: DossierRow[]) {
  const blob = new Blob(["\uFEFF" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dossiers-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const STATUS_TABS: { id: CommercialStatus | "all"; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "nouveau", label: "Nouveaux" },
  { id: "contacte", label: "Contactés" },
  { id: "devise", label: "Devisés" },
  { id: "gagne", label: "Gagnés" },
  { id: "perdu", label: "Perdus" },
];

const STATUS_STYLES: Record<CommercialStatus, string> = {
  nouveau: "border-emerald-300 bg-emerald-50 text-emerald-800",
  contacte: "border-sky-300 bg-sky-50 text-sky-800",
  devise: "border-amber-300 bg-amber-50 text-amber-800",
  gagne: "border-emerald-400 bg-emerald-100 text-emerald-900",
  perdu: "border-red-300 bg-red-50 text-red-800",
};

function StatusBadge({ status }: { status: string }) {
  const style =
    STATUS_STYLES[status as CommercialStatus] ?? "border-border bg-muted text-foreground";
  const label = STATUS_TABS.find((t) => t.id === status)?.label ?? status;
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${style}`}
    >
      {label}
    </span>
  );
}

const USAGE_BANNER_STYLES = {
  ok: "border-border bg-card text-muted-foreground",
  warning: "border-amber-300 bg-amber-50 text-amber-900",
  over: "border-destructive/40 bg-destructive/5 text-destructive",
} as const;

function UsageBanner({ workspaceId }: { workspaceId: string }) {
  const fetchUsage = useServerFn(getMyWorkspaceUsage);
  const { data } = useQuery({
    queryKey: ["portal", "workspace-usage", workspaceId] as const,
    queryFn: () => fetchUsage({ data: { workspaceId } }),
    enabled: workspaceId.length > 0,
  });
  if (!data) return null;
  const level = usageLevel(data.monthlyBriefs, data.monthlyBriefQuota);
  if (level === "ok") return null;
  return (
    <div className={`rounded-lg border px-4 py-2.5 text-sm ${USAGE_BANNER_STYLES[level]}`}>
      {level === "over" ? "Quota mensuel atteint : " : "Vous approchez de votre quota mensuel : "}
      {data.monthlyBriefs} / {data.monthlyBriefQuota} Project Briefs ce mois-ci. Aucune demande
      n'est refusée pour autant — contactez l'équipe Métré Build pour ajuster votre plan si besoin.
    </div>
  );
}

/**
 * Entry point into the self-service setup (/portal/setup) for a workspace
 * that has no draft intake yet — a brand new workspace lands on this list
 * with nothing in it, so this is its explicit next step.
 */
function SetupNextStep({ workspaceId }: { workspaceId: string }) {
  const fetchSetup = useServerFn(getMySetup);
  const { data } = useQuery({
    queryKey: ["portal", "setup", workspaceId] as const,
    queryFn: () => fetchSetup({ data: { workspaceId } }),
    enabled: workspaceId.length > 0,
    retry: false,
  });
  if (!data || data.status === "draft_ready") return null;

  const started = data.analysis !== null;
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
      <div>
        <p className="text-sm font-semibold text-foreground">
          {started ? "Finish setting up your project intake" : "Next step: set up your project intake"}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {started
            ? "You started the setup — pick up where you left off."
            : "Give us your website and we will propose a deck project intake you can review. Nothing goes live automatically."}
        </p>
      </div>
      <Link
        to="/portal/setup"
        className="mt-3 inline-flex shrink-0 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 sm:mt-0"
      >
        {started ? "Continue setup" : "Start setup"}
      </Link>
    </div>
  );
}

function PortalHomePage() {
  const fetchWorkspaces = useServerFn(listMyWorkspaces);
  const wsOpts = queryOptions({
    queryKey: ["portal", "workspaces"] as const,
    queryFn: () => fetchWorkspaces(),
  });
  const { data: workspaces } = useSuspenseQuery(wsOpts);

  const [workspaceId, setWorkspaceId] = useState<string>(workspaces[0]?.id ?? "");
  const [tab, setTab] = useState<CommercialStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const fetchDossiers = useServerFn(listWorkspaceDossiers);
  const {
    data: dossiers,
    isPending: dossiersPending,
    error: dossiersError,
  } = useQuery({
    queryKey: ["portal", "dossiers", workspaceId] as const,
    queryFn: () => fetchDossiers({ data: { workspaceId } }),
    enabled: workspaceId.length > 0,
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: dossiers?.length ?? 0 };
    for (const d of dossiers ?? []) c[d.commercial_status] = (c[d.commercial_status] ?? 0) + 1;
    return c;
  }, [dossiers]);

  const filtered = useMemo(() => {
    let res = dossiers ?? [];
    if (tab !== "all") res = res.filter((d) => d.commercial_status === tab);
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      res = res.filter((d) => (d.summary ?? "").toLowerCase().includes(s));
    }
    return res;
  }, [dossiers, tab, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (workspaces.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Aucun Espace Client associé à ce compte pour le moment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Mes Dossiers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Les demandes reçues via vos Missions, à suivre jusqu'à la clôture.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => downloadCsv(filtered as DossierRow[])}
            disabled={filtered.length === 0}
            className="rounded-md border border-input bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
          >
            Exporter en CSV
          </button>
        {workspaces.length > 1 && (
          <select
            value={workspaceId}
            onChange={(e) => {
              setWorkspaceId(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        )}
        </div>
      </header>

      {workspaceId && <SetupNextStep workspaceId={workspaceId} />}

      {workspaceId && <UsageBanner workspaceId={workspaceId} />}


      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              setPage(1);
            }}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              tab === t.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:bg-accent"
            }`}
          >
            {t.label} ({counts[t.id] ?? 0})
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Rechercher…"
          className="ml-auto w-full max-w-[220px] rounded-md border border-input bg-background px-3 py-1.5 text-xs"
        />
      </div>

      {dossiersError ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {dossiersError instanceof Error
            ? dossiersError.message
            : "Impossible de charger vos Dossiers."}
        </p>
      ) : dossiersPending ? (
        <PortalPending />
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Aucun Dossier ne correspond pour l'instant.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Résumé</th>
                <th className="px-4 py-2 text-left">Statut</th>
                <th className="px-4 py-2 text-left">Dernière activité</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-border/60 last:border-b-0 hover:bg-accent/30"
                >
                  <td className="px-4 py-3">
                    <Link
                      to="/portal/dossiers/$id"
                      params={{ id: d.id }}
                      className="font-medium text-foreground hover:underline"
                    >
                      {d.summary ?? `Dossier ${d.id.slice(0, 8)}`}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={d.commercial_status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(d.last_activity_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {currentPage} sur {pageCount} · {filtered.length} Dossiers
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-md border border-input bg-background px-3 py-1.5 hover:bg-accent disabled:opacity-50"
            >
              Précédent
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={currentPage === pageCount}
              className="rounded-md border border-input bg-background px-3 py-1.5 hover:bg-accent disabled:opacity-50"
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
