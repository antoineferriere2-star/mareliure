import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyBinderCases } from "@/marketplace/services/marketplace.data.functions";
import { getMyQuotes } from "@/marketplace/services/binderQuotes.data.functions";
import { getMyWorks } from "@/marketplace/services/binderWorks.data.functions";
import { caseGroup, nextCaseAction, type CaseGroup } from "@/marketplace/cases/workspace";
import { CARD, FIELD } from "@/marketplace/pages/binder/quotes/quoteUi";
import { matchesSearch } from "@/marketplace/works/workSearch";

const GROUPS: { key: CaseGroup | "all"; label: string }[] = [
  { key: "all", label: "Tous" }, { key: "new", label: "Nouveaux" },
  { key: "current", label: "En cours" }, { key: "waiting", label: "En attente" },
  { key: "quote", label: "Devis à faire" }, { key: "sent", label: "Devis envoyé" },
  { key: "closed", label: "Clos" },
];

export function LeadsPage() {
  const fetchCases = useServerFn(listMyBinderCases);
  const fetchWorks = useServerFn(getMyWorks);
  const fetchQuotes = useServerFn(getMyQuotes);
  const cases = useQuery({ queryKey: ["marketplace", "binder", "cases"], queryFn: () => fetchCases() });
  const works = useQuery({ queryKey: ["binder", "works"], queryFn: () => fetchWorks({ data: {} }) });
  const quotes = useQuery({ queryKey: ["binder", "quotes"], queryFn: () => fetchQuotes() });
  const [filter, setFilter] = useState<CaseGroup | "all">("all");
  const [search, setSearch] = useState("");

  const workByCase = useMemo(() => new Map((works.data ?? []).filter((work) => work.caseId).map((work) => [work.caseId, work] as const)), [works.data]);
  const rows = (cases.data ?? []).filter((row) => {
    const work = workByCase.get(row.caseId);
    const related = (quotes.data ?? []).filter((quote) => quote.workId && quote.workId === work?.id);
    const group = caseGroup(row, related.some((quote) => quote.status === "draft"), related.some((quote) => quote.status === "sent"));
    return (filter === "all" || group === filter) && matchesSearch(`${row.title} ${row.reference} ${row.clientName ?? ""} ${row.summary}`, search);
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-serif text-2xl">Leads</h1>
        <p className="mt-1 text-sm text-muted-foreground">Les demandes qui vous ont été confiées par Ma Reliure.</p>
      </header>
      <input className={`${FIELD} w-full sm:max-w-sm`} aria-label="Rechercher un dossier" placeholder="Client, ouvrage, référence…" value={search} onChange={(event) => setSearch(event.target.value)} />
      <div className="flex flex-wrap gap-2" aria-label="Filtrer les leads">
        {GROUPS.map((group) => <button key={group.key} type="button" aria-pressed={filter === group.key} onClick={() => setFilter(group.key)} className={`min-h-11 rounded-full border px-3 text-sm ${filter === group.key ? "border-foreground bg-foreground text-background" : "border-border"}`}>{group.label}</button>)}
      </div>
      {cases.isPending || works.isPending || quotes.isPending ? <p role="status">Chargement des demandes…</p> : null}
      {cases.isError || works.isError || quotes.isError ? <p role="alert">Les demandes n'ont pas pu être chargées.</p> : null}
      {cases.data && rows.length === 0 && <div className={CARD}>Vous n'avez aucune demande dans cette vue.</div>}
      <ul className="grid gap-3 md:grid-cols-2">
        {rows.map((row) => {
          const work = workByCase.get(row.caseId);
          const hasDraft = (quotes.data ?? []).some((quote) => quote.workId === work?.id && quote.status === "draft");
          return <li key={row.caseId} className={`${CARD} flex flex-col justify-between`}>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Projet Ma Reliure · {row.reference}</p>
              <h2 className="mt-2 font-serif text-lg">{row.title}</h2>
              {row.clientName && <p className="text-sm">{row.clientName}</p>}
              <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{row.summary}</p>
              <p className="mt-3 text-xs text-muted-foreground">{new Date(row.createdAt).toLocaleDateString("fr-FR")} · {row.unreadCount > 0 ? `${row.unreadCount} message(s) non lu(s)` : nextCaseAction(row, Boolean(work), hasDraft)}</p>
            </div>
            <Link to="/atelier/leads/$leadId" params={{ leadId: row.caseId }} className="mt-3 inline-flex min-h-11 items-center text-sm font-medium underline">Ouvrir le dossier</Link>
          </li>;
        })}
      </ul>
    </div>
  );
}
