/**
 * What a relieur sees when they sign in: the projects they were invited to,
 * and nothing else. The list is built server-side from their own match rows —
 * a workshop cannot reach a case it was not given.
 */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyBinderCases } from "@/marketplace/services/marketplace.data.functions";
import { formatEuros } from "@/marketplace/pricing/money";

const GROUPS = [
  { key: "offered", title: "Nouvelles offres" },
  { key: "accepted", title: "Disponibilités confirmées" },
  { key: "selected", title: "Commandes en cours" },
  { key: "declined", title: "Offres refusées" },
  { key: "cancelled", title: "Offres clôturées" },
] as const;

export function BinderDashboardPage() {
  const fetchCases = useServerFn(listMyBinderCases);
  const { data, isPending, error } = useQuery({
    queryKey: ["marketplace", "binder", "cases"] as const,
    queryFn: () => fetchCases(),
  });

  if (isPending) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;

  const cases = data ?? [];

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-serif text-2xl">Votre atelier</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {cases.length} projet(s) vous ont été confiés.
        </p>
      </header>

      {GROUPS.map((group) => {
        const rows = cases.filter((row) => row.state === group.key);
        if (rows.length === 0) return null;
        return (
          <section key={group.key}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {group.title}
            </h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {rows.map((row) => (
                <li key={row.caseId}>
                  <Link
                    to="/atelier/cases/$caseId"
                    params={{ caseId: row.caseId }}
                    className="block h-full rounded-lg border border-border bg-card p-4 transition hover:border-foreground/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-serif text-lg">{row.title}</p>
                      {row.unreadCount > 0 && (
                        <span className="shrink-0 rounded-full bg-foreground px-2 py-0.5 text-xs font-semibold text-background">
                          {row.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{row.summary}</p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {row.reference} · {row.photoCount} photo(s)
                      {row.binderPayoutCents &&
                        ` · rémunération ${formatEuros(row.binderPayoutCents)}`}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {cases.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Aucun projet pour le moment. Vous recevrez une invitation dès qu'un dossier correspondra à
          votre atelier.
        </p>
      )}
    </div>
  );
}
