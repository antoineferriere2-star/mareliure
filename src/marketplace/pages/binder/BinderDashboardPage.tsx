/** The relieur's actionable start page, assembled from existing atelier data. */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyBinderCases } from "@/marketplace/services/marketplace.data.functions";
import { getMyQuotes } from "@/marketplace/services/binderQuotes.data.functions";
import { getMyWorks } from "@/marketplace/services/binderWorks.data.functions";
import { caseGroup, nextCaseAction } from "@/marketplace/cases/workspace";
import { CARD, PRIMARY_BUTTON } from "@/marketplace/pages/binder/quotes/quoteUi";

const CASES_KEY = ["marketplace", "binder", "cases"] as const;

export function BinderDashboardPage() {
  const fetchCases = useServerFn(listMyBinderCases);
  const fetchQuotes = useServerFn(getMyQuotes);
  const fetchWorks = useServerFn(getMyWorks);
  const cases = useQuery({ queryKey: CASES_KEY, queryFn: () => fetchCases() });
  const quotes = useQuery({ queryKey: ["binder", "quotes"], queryFn: () => fetchQuotes() });
  const works = useQuery({ queryKey: ["binder", "works"], queryFn: () => fetchWorks({ data: {} }) });

  if (cases.isPending || quotes.isPending || works.isPending) return <p role="status">Chargement de votre journée…</p>;
  if (cases.isError || quotes.isError || works.isError) return <p role="alert">Votre journée n'a pas pu être chargée. Rechargez la page.</p>;

  const caseRows = cases.data ?? [];
  const quoteRows = quotes.data ?? [];
  const workRows = works.data ?? [];
  const caseWork = new Map(workRows.filter((work) => work.caseId).map((work) => [work.caseId, work] as const));
  const newCases = caseRows.filter((row) => caseGroup(row) === "new");
  const unreadCases = caseRows.filter((row) => row.unreadCount > 0);
  const drafts = quoteRows.filter((quote) => quote.status === "draft");
  const sent = quoteRows.filter((quote) => quote.status === "sent");
  const toInvoice = quoteRows.filter((quote) => quote.status === "accepted");
  const openWorks = workRows.filter((work) => work.status === "active");

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Votre atelier</p>
          <h1 className="font-serif text-3xl">Aujourd'hui</h1>
          <p className="mt-1 text-sm text-muted-foreground">Les dossiers et documents qui demandent votre attention.</p>
        </div>
        <Link to="/atelier/devis/nouveau" className={PRIMARY_BUTTON}>Nouveau devis</Link>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Actions à traiter">
        {[
          { title: "Nouvelles demandes", count: newCases.length, to: "/atelier/leads" as const, detail: "à examiner" },
          { title: "Messages", count: unreadCases.reduce((total, row) => total + row.unreadCount, 0), to: "/atelier/messages" as const, detail: "non lus" },
          { title: "Devis", count: drafts.length, to: "/atelier/devis" as const, detail: `${sent.length} envoyé(s) en attente` },
          { title: "Ouvrages", count: openWorks.length, to: "/atelier/ouvrages" as const, detail: "fiches actives" },
          { title: "Facturation", count: toInvoice.length, to: "/atelier/factures" as const, detail: "devis acceptés" },
        ].map((item) => (
          <Link key={item.title} to={item.to} className={`${CARD} block hover:border-foreground/40`}>
            <span className="block text-sm text-muted-foreground">{item.title}</span>
            <strong className="mt-2 block text-3xl tabular-nums">{item.count}</strong>
            <span className="mt-1 block text-xs text-muted-foreground">{item.detail}</span>
          </Link>
        ))}
      </div>
      <section aria-labelledby="actions-heading">
        <h2 id="actions-heading" className="font-serif text-xl">À faire</h2>
        <ul className="mt-3 space-y-3">
          {caseRows.filter((row) => row.unreadCount > 0 || caseGroup(row) === "new" || row.state === "selected").slice(0, 8).map((row) => {
            const work = caseWork.get(row.caseId);
            return (
              <li key={row.caseId} className={CARD}>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Projet Ma Reliure</p>
                <p className="mt-1 font-serif text-lg">{row.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{row.summary}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <span>{nextCaseAction(row, Boolean(work), Boolean(work && drafts.some((quote) => quote.workId === work.id)))}</span>
                  <Link to="/atelier/leads/$leadId" params={{ leadId: row.caseId }} className="min-h-11 content-center font-medium underline">Voir le dossier</Link>
                </div>
              </li>
            );
          })}
          {drafts.slice(0, 3).map((quote) => (
            <li key={quote.id} className={CARD}>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Devis à terminer</p>
              <p className="mt-1 font-serif text-lg">{quote.bookTitle || quote.clientName}</p>
              <Link to="/atelier/devis/$quoteId/modifier" params={{ quoteId: quote.id }} className="mt-2 inline-flex min-h-11 items-center text-sm font-medium underline">Continuer le devis {quote.number}</Link>
            </li>
          ))}
          {caseRows.length === 0 && drafts.length === 0 && <li className={`${CARD} text-sm text-muted-foreground`}>Aucune nouvelle demande ni devis à terminer. <Link to="/atelier/devis/nouveau" className="underline">Créer mon premier devis</Link></li>}
        </ul>
      </section>
    </div>
  );
}
