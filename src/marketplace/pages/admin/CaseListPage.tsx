/**
 * The back-office queue: every Dossier the Reliure Mission has produced.
 *
 * The list is deliberately operable by a person rather than automated (§51):
 * cases held for manual review are shown first and marked, and nothing leaves
 * this screen for a relieur without someone clicking.
 */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMarketplaceCases } from "@/marketplace/services/marketplace.data.functions";
import { CASE_STATUS_LABELS, isCaseStatus } from "@/marketplace/cases/state";

function statusLabel(status: string): string {
  return isCaseStatus(status) ? CASE_STATUS_LABELS[status] : status;
}

export function CaseListPage() {
  const fetchCases = useServerFn(listMarketplaceCases);
  const { data, isPending, error } = useQuery({
    queryKey: ["marketplace", "cases"] as const,
    queryFn: () => fetchCases(),
  });

  if (isPending) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;

  const cases = data ?? [];
  const toReview = cases.filter((c) => c.manual_review_required);
  const rest = cases.filter((c) => !c.manual_review_required);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-2xl">Demandes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {cases.length} dossier(s) · {toReview.length} en attente de revue manuelle
        </p>
      </header>

      {toReview.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            À examiner avant diffusion
          </h2>
          <ul className="mt-3 space-y-2">
            {toReview.map((row) => (
              <CaseRow key={row.id} row={row} />
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Tous les dossiers
        </h2>
        {rest.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Aucun dossier pour le moment. Ils apparaissent ici dès qu'un visiteur termine la Mission
            Reliure.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {rest.map((row) => (
              <CaseRow key={row.id} row={row} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

type Row = Awaited<ReturnType<typeof listMarketplaceCases>>[number];

function CaseRow({ row }: { row: Row }) {
  return (
    <li>
      <Link
        to="/marketplace/cases/$caseId"
        params={{ caseId: row.id }}
        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 transition hover:border-foreground/30"
      >
        <span className="min-w-0">
          <span className="block truncate font-medium">{row.title}</span>
          <span className="text-xs text-muted-foreground">
            {row.reference} · {statusLabel(row.status)}
            {row.heritage_flag && " · ouvrage patrimonial"}
          </span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {row.invitedCount} invité(s) · {row.quoteCount} proposition(s)
        </span>
      </Link>
    </li>
  );
}
