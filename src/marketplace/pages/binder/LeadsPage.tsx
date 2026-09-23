import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyBinderCases } from "@/marketplace/services/marketplace.data.functions";
import { getMyQuotes } from "@/marketplace/services/binderQuotes.data.functions";
import { getMyWorks } from "@/marketplace/services/binderWorks.data.functions";
import { caseGroup, nextCaseAction, type CaseGroup } from "@/marketplace/cases/workspace";
import { FIELD } from "@/marketplace/pages/binder/quotes/quoteUi";
import { matchesSearch } from "@/marketplace/works/workSearch";
import { Search } from "lucide-react";
import { BinderEmptyState, BinderPageHeader } from "./BinderPageUi";
import { sourceLabel } from "@/marketplace/binders/fineBinderyProfile";

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
    <div className="space-y-7">
      <BinderPageHeader eyebrow="Demandes confiées" title="Leads" description="Décidez rapidement, puis gardez chaque projet relié à son prochain geste." />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#74695d]" /><input className={`${FIELD} w-full pl-9`} aria-label="Rechercher un dossier" placeholder="Client, ouvrage, référence…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filtrer les leads">
          {GROUPS.map((group) => <button key={group.key} type="button" aria-pressed={filter === group.key} onClick={() => setFilter(group.key)} className={`min-h-10 shrink-0 rounded-full border px-3 text-xs font-semibold ${filter === group.key ? "border-[#241a12] bg-[#241a12] text-white" : "border-[#cfc5b6] bg-[#fffdf8] text-[#685d51]"}`}>{group.label}</button>)}
        </div>
      </div>
      {cases.isPending || works.isPending || quotes.isPending ? <p role="status">Chargement des demandes…</p> : null}
      {cases.isError || works.isError || quotes.isError ? <p role="alert">Les demandes n'ont pas pu être chargées.</p> : null}
      {cases.data && rows.length === 0 && <BinderEmptyState title="Aucune demande dans cette vue" description="Modifiez le filtre ou la recherche pour retrouver un autre dossier." />}
      <ul className="divide-y divide-[#d8d0c4] border-y border-[#cfc5b6] bg-[#fffdf8]">
        {rows.map((row) => {
          const work = workByCase.get(row.caseId);
          const hasDraft = (quotes.data ?? []).some((quote) => quote.workId === work?.id && quote.status === "draft");
          const group = caseGroup(row, hasDraft, false);
          return <li key={row.caseId}><Link to="/atelier/leads/$leadId" params={{ leadId: row.caseId }} className="group grid gap-3 px-4 py-5 transition hover:bg-[#f5f0e8] sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-center sm:px-5">
            <span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><span className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#7a2230]">{GROUPS.find((item) => item.key === group)?.label ?? "Projet"}</span><span className="border border-[#cfc5b6] px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[#59635b]">{sourceLabel(row.acquisitionOrigin)}</span>{row.unreadCount > 0 && <span className="rounded-full bg-[#7a2230] px-2 py-0.5 text-[0.64rem] font-bold text-white">{row.unreadCount} nouveau</span>}</span><strong className="mt-1 block font-editorial text-xl font-normal leading-tight">{row.title}</strong><span className="mt-1 block text-xs text-[#74695d]">{row.clientName || "Projet"} · {row.reference} · {new Date(row.createdAt).toLocaleDateString("fr-FR")}</span><span className="mt-2 block line-clamp-2 text-sm leading-6 text-[#685d51]">{row.summary}</span></span>
            <span className="border-l-0 border-[#d8d0c4] sm:border-l sm:pl-5"><span className="block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#8b8175]">Prochaine action</span><span className="mt-1 block text-sm font-semibold text-[#34281f]">{nextCaseAction(row, Boolean(work), hasDraft)}</span><span className="mt-3 inline-block text-sm font-semibold text-[#5f1b27] underline decoration-[#7a2230]/30 underline-offset-4 group-hover:decoration-current">Ouvrir le dossier</span></span>
          </Link></li>;
        })}
      </ul>
    </div>
  );
}
