/**
 * "Mes livres" — the customer's own cases, matched to their account by the
 * e-mail they gave the intake. A card leads with the book, not with a status
 * code (§48).
 */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyCustomerCases } from "@/marketplace/services/marketplace.data.functions";
import { CASE_STATUS_LABELS, isCaseStatus } from "@/marketplace/cases/state";

/** What the customer should do next, or what is being done for them. */
function nextStep(status: string, quoteCount: number): string {
  switch (status) {
    case "under_review":
    case "matching":
      return "Nous sélectionnons les relieurs adaptés à votre projet.";
    case "sent_to_binders":
      return "Les relieurs préparent leur proposition.";
    case "quotes_received":
      return `${quoteCount} proposition(s) à comparer.`;
    case "binder_selected":
      return "Votre relieur est choisi.";
    default:
      return isCaseStatus(status) ? CASE_STATUS_LABELS[status] : status;
  }
}

export function CustomerCaseListPage() {
  const fetchCases = useServerFn(listMyCustomerCases);
  const { data, isPending, error } = useQuery({
    queryKey: ["marketplace", "customer", "cases"] as const,
    queryFn: () => fetchCases(),
  });

  if (isPending) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;

  const cases = data ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-2xl">Mes livres</h1>
      </header>

      {cases.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun projet pour l'instant. Les demandes envoyées avec cette adresse e-mail apparaissent
          ici.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {cases.map((row) => (
            <li key={row.id}>
              <Link
                to="/mes-livres/$caseId"
                params={{ caseId: row.id }}
                className="block rounded-2xl border border-[#3b2a1d]/15 bg-[#fdfaf3] p-6 transition hover:border-[#3b2a1d]/40"
              >
                <p className="font-serif text-xl text-[#241a12]">{row.title}</p>
                <p className="mt-1 text-xs text-[#8a7663]">{row.reference}</p>
                <p className="mt-4 text-sm text-[#4b3a2c]">
                  {nextStep(row.status, row.quoteCount)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
