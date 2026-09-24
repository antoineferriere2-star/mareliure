import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyBinderCases } from "@/marketplace/services/marketplace.data.functions";
import { getMyQuotes } from "@/marketplace/services/binderQuotes.data.functions";
import { getMyWorks } from "@/marketplace/services/binderWorks.data.functions";
import { caseGroup, nextCaseAction, type CaseGroup } from "@/marketplace/cases/workspace";
import { FIELD } from "@/marketplace/pages/binder/quotes/quoteUi";
import { QUOTES_KEY } from "@/marketplace/pages/binder/quotes/quoteQueryKeys";
import { WORKS_KEY } from "@/marketplace/pages/binder/works/workKeys";
import { matchesSearch } from "@/marketplace/works/workSearch";
import { Search } from "lucide-react";
import { BinderEmptyState, BinderPageHeader } from "./BinderPageUi";
import { sourceLabel } from "@/marketplace/binders/fineBinderyProfile";
import { useFineBinderyWorkspace } from "@/marketplace/i18n/FineBinderyWorkspaceContext";
import { formatFineBinderyDate } from "@/marketplace/i18n/fineBinderyFormat";
import { languageName } from "@/marketplace/i18n/fineBinderyGlossary";
import type { FineBinderyLocale } from "@/marketplace/i18n/fineBinderyLocale";

const GROUP_KEYS: Array<CaseGroup | "all"> = ["all", "new", "current", "waiting", "quote", "sent", "closed"];

const PROJECT_COPY: Record<FineBinderyLocale, {
  eyebrow: string; title: string; description: string; search: string; placeholder: string;
  filter: string; loading: string; error: string; empty: string; emptyBody: string;
  project: string; language: string; unread: string; next: string; open: string;
  groups: Record<CaseGroup | "all", string>; sources: Record<string, string>;
  actions: Record<string, string>;
}> = {
  en: { eyebrow: "Entrusted projects", title: "Projects", description: "Review each request, then keep every project connected to its next action.", search: "Search projects", placeholder: "Client, book, reference…", filter: "Filter projects", loading: "Loading projects…", error: "Projects could not be loaded.", empty: "No project in this view", emptyBody: "Change the filter or search to find another project.", project: "Project", language: "Language", unread: "new", next: "Next action", open: "Open project", groups: { all: "All", new: "New", current: "In progress", waiting: "Waiting", quote: "Quote to prepare", sent: "Quote sent", closed: "Closed" }, sources: { FINEBINDERY_PROFILE: "FineBindery page", BINDER_REFERRED: "My workshop", MA_RELIURE_ACQUIRED: "Ma Reliure" }, actions: { "Répondre au message": "Reply to message", "Examiner la demande": "Review request", "Attendre la sélection": "Wait for selection", "Créer la fiche ouvrage": "Create book record", "Continuer le devis": "Continue quote", "Créer un devis": "Create quote", "Suivre le dossier": "Follow project" } },
  fr: { eyebrow: "Projets confiés", title: "Projets", description: "Décidez rapidement, puis gardez chaque projet relié à son prochain geste.", search: "Rechercher un dossier", placeholder: "Client, ouvrage, référence…", filter: "Filtrer les projets", loading: "Chargement des projets…", error: "Les projets n’ont pas pu être chargés.", empty: "Aucun projet dans cette vue", emptyBody: "Modifiez le filtre ou la recherche pour retrouver un autre projet.", project: "Projet", language: "Langue", unread: "nouveau", next: "Prochaine action", open: "Ouvrir le dossier", groups: { all: "Tous", new: "Nouveaux", current: "En cours", waiting: "En attente", quote: "Devis à faire", sent: "Devis envoyé", closed: "Clos" }, sources: { FINEBINDERY_PROFILE: "Page FineBindery", BINDER_REFERRED: "Mon atelier", MA_RELIURE_ACQUIRED: "Ma Reliure" }, actions: {} },
  de: { eyebrow: "Anvertraute Projekte", title: "Projekte", description: "Prüfen Sie jede Anfrage und behalten Sie den nächsten Schritt im Blick.", search: "Projekte suchen", placeholder: "Kunde, Buch, Referenz…", filter: "Projekte filtern", loading: "Projekte werden geladen…", error: "Projekte konnten nicht geladen werden.", empty: "Keine Projekte in dieser Ansicht", emptyBody: "Ändern Sie Filter oder Suche.", project: "Projekt", language: "Sprache", unread: "neu", next: "Nächster Schritt", open: "Projekt öffnen", groups: { all: "Alle", new: "Neu", current: "In Arbeit", waiting: "Wartet", quote: "Angebot erstellen", sent: "Angebot gesendet", closed: "Abgeschlossen" }, sources: { FINEBINDERY_PROFILE: "FineBindery-Seite", BINDER_REFERRED: "Meine Werkstatt", MA_RELIURE_ACQUIRED: "Ma Reliure" }, actions: { "Répondre au message": "Nachricht beantworten", "Examiner la demande": "Anfrage prüfen", "Attendre la sélection": "Auswahl abwarten", "Créer la fiche ouvrage": "Buchakte anlegen", "Continuer le devis": "Angebot fortsetzen", "Créer un devis": "Angebot erstellen", "Suivre le dossier": "Projekt verfolgen" } },
  it: { eyebrow: "Progetti affidati", title: "Progetti", description: "Esamina ogni richiesta e mantieni ogni progetto collegato alla prossima azione.", search: "Cerca progetti", placeholder: "Cliente, libro, riferimento…", filter: "Filtra progetti", loading: "Caricamento progetti…", error: "Impossibile caricare i progetti.", empty: "Nessun progetto in questa vista", emptyBody: "Modifica il filtro o la ricerca.", project: "Progetto", language: "Lingua", unread: "nuovo", next: "Prossima azione", open: "Apri progetto", groups: { all: "Tutti", new: "Nuovi", current: "In corso", waiting: "In attesa", quote: "Preventivo da preparare", sent: "Preventivo inviato", closed: "Chiusi" }, sources: { FINEBINDERY_PROFILE: "Pagina FineBindery", BINDER_REFERRED: "Il mio laboratorio", MA_RELIURE_ACQUIRED: "Ma Reliure" }, actions: { "Répondre au message": "Rispondi al messaggio", "Examiner la demande": "Esamina la richiesta", "Attendre la sélection": "Attendi la selezione", "Créer la fiche ouvrage": "Crea scheda libro", "Continuer le devis": "Continua preventivo", "Créer un devis": "Crea preventivo", "Suivre le dossier": "Segui progetto" } },
  es: { eyebrow: "Proyectos confiados", title: "Proyectos", description: "Revisa cada solicitud y mantén cada proyecto conectado con su siguiente acción.", search: "Buscar proyectos", placeholder: "Cliente, libro, referencia…", filter: "Filtrar proyectos", loading: "Cargando proyectos…", error: "No se pudieron cargar los proyectos.", empty: "No hay proyectos en esta vista", emptyBody: "Cambia el filtro o la búsqueda.", project: "Proyecto", language: "Idioma", unread: "nuevo", next: "Siguiente acción", open: "Abrir proyecto", groups: { all: "Todos", new: "Nuevos", current: "En curso", waiting: "En espera", quote: "Presupuesto pendiente", sent: "Presupuesto enviado", closed: "Cerrados" }, sources: { FINEBINDERY_PROFILE: "Página FineBindery", BINDER_REFERRED: "Mi taller", MA_RELIURE_ACQUIRED: "Ma Reliure" }, actions: { "Répondre au message": "Responder al mensaje", "Examiner la demande": "Revisar solicitud", "Attendre la sélection": "Esperar selección", "Créer la fiche ouvrage": "Crear ficha del libro", "Continuer le devis": "Continuar presupuesto", "Créer un devis": "Crear presupuesto", "Suivre le dossier": "Seguir proyecto" } },
};

export function LeadsPage() {
  const { isFineBindery, locale } = useFineBinderyWorkspace();
  const t = PROJECT_COPY[isFineBindery ? locale : "fr"];
  const fetchCases = useServerFn(listMyBinderCases);
  const fetchWorks = useServerFn(getMyWorks);
  const fetchQuotes = useServerFn(getMyQuotes);
  const cases = useQuery({ queryKey: ["marketplace", "binder", "cases"], queryFn: () => fetchCases() });
  const works = useQuery({ queryKey: WORKS_KEY, queryFn: () => fetchWorks({ data: {} }) });
  const quotes = useQuery({ queryKey: QUOTES_KEY, queryFn: () => fetchQuotes() });
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
      <BinderPageHeader eyebrow={t.eyebrow} title={t.title} description={t.description} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#74695d]" /><input className={`${FIELD} w-full pl-9`} aria-label={t.search} placeholder={t.placeholder} value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label={t.filter}>
          {GROUP_KEYS.map((key) => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className={`min-h-10 shrink-0 rounded-full border px-3 text-xs font-semibold ${filter === key ? "border-[#241a12] bg-[#241a12] text-white" : "border-[#cfc5b6] bg-[#fffdf8] text-[#685d51]"}`}>{t.groups[key]}</button>)}
        </div>
      </div>
      {cases.isPending || works.isPending || quotes.isPending ? <p role="status">{t.loading}</p> : null}
      {cases.isError || works.isError || quotes.isError ? <p role="alert">{t.error}</p> : null}
      {cases.data && rows.length === 0 && <BinderEmptyState title={t.empty} description={t.emptyBody} />}
      <ul className="divide-y divide-[#d8d0c4] border-y border-[#cfc5b6] bg-[#fffdf8]">
        {rows.map((row) => {
          const work = workByCase.get(row.caseId);
          const hasDraft = (quotes.data ?? []).some((quote) => quote.workId === work?.id && quote.status === "draft");
          const group = caseGroup(row, hasDraft, false);
          return <li key={row.caseId}><Link to="/atelier/leads/$leadId" params={{ leadId: row.caseId }} className="group grid gap-3 px-4 py-5 transition hover:bg-[#f5f0e8] sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-center sm:px-5">
            <span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><span className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#7a2230]">{t.groups[group] ?? t.project}</span><span className="border border-[#cfc5b6] px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[#59635b]">{isFineBindery ? (t.sources[row.acquisitionOrigin] ?? t.project) : sourceLabel(row.acquisitionOrigin)}</span>{row.preferredLanguage && <span className="border border-[#cfc5b6] px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[#59635b]">{t.language} · {isFineBindery ? languageName(row.preferredLanguage, locale) : row.preferredLanguage.toUpperCase()}</span>}{row.unreadCount > 0 && <span className="rounded-full bg-[#7a2230] px-2 py-0.5 text-[0.64rem] font-bold text-white">{row.unreadCount} {t.unread}</span>}</span><strong className="mt-1 block font-editorial text-xl font-normal leading-tight">{row.title}</strong><span className="mt-1 block text-xs text-[#74695d]">{row.clientName || t.project} · {row.reference} · {isFineBindery ? formatFineBinderyDate(row.createdAt, locale) : new Date(row.createdAt).toLocaleDateString("fr-FR")}</span><span className="mt-2 block line-clamp-2 text-sm leading-6 text-[#685d51]">{row.summary}</span></span>
            <span className="border-l-0 border-[#d8d0c4] sm:border-l sm:pl-5"><span className="block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#8b8175]">{t.next}</span><span className="mt-1 block text-sm font-semibold text-[#34281f]">{t.actions[nextCaseAction(row, Boolean(work), hasDraft)] ?? nextCaseAction(row, Boolean(work), hasDraft)}</span><span className="mt-3 inline-block text-sm font-semibold text-[#5f1b27] underline decoration-[#7a2230]/30 underline-offset-4 group-hover:decoration-current">{t.open}</span></span>
          </Link></li>;
        })}
      </ul>
    </div>
  );
}
