/** La page d'arrivée répond à une question : qu'est-ce qui mérite mon attention maintenant ? */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CircleCheck, FilePenLine, Inbox, MessageSquare } from "lucide-react";
import { listMyBinderCases } from "@/marketplace/services/marketplace.data.functions";
import { getMyQuotes } from "@/marketplace/services/binderQuotes.data.functions";
import { getMyWorks } from "@/marketplace/services/binderWorks.data.functions";
import { caseGroup, nextCaseAction } from "@/marketplace/cases/workspace";
import { PRIMARY_BUTTON } from "@/marketplace/pages/binder/quotes/quoteUi";
import { BinderEmptyState, BinderLoading, BinderPageHeader, BinderSectionTitle } from "./BinderPageUi";

const CASES_KEY = ["marketplace", "binder", "cases"] as const;

export function BinderDashboardPage() {
  const fetchCases = useServerFn(listMyBinderCases);
  const fetchQuotes = useServerFn(getMyQuotes);
  const fetchWorks = useServerFn(getMyWorks);
  const cases = useQuery({ queryKey: CASES_KEY, queryFn: () => fetchCases() });
  const quotes = useQuery({ queryKey: ["binder", "quotes"], queryFn: () => fetchQuotes() });
  const works = useQuery({ queryKey: ["binder", "works"], queryFn: () => fetchWorks({ data: {} }) });

  if (cases.isPending || quotes.isPending || works.isPending) return <BinderLoading label="Préparation de votre journée…" />;
  if (cases.isError || quotes.isError || works.isError) return <p role="alert" className="border-l-4 border-red-700 bg-red-50 px-5 py-4 text-sm text-red-950">Votre journée n'a pas pu être chargée. Rechargez la page.</p>;

  const caseRows = cases.data ?? [];
  const quoteRows = quotes.data ?? [];
  const workRows = works.data ?? [];
  const caseWork = new Map(workRows.filter((work) => work.caseId).map((work) => [work.caseId, work] as const));
  const urgentCases = caseRows.filter((row) => row.unreadCount > 0 || caseGroup(row) === "new" || row.state === "selected");
  const drafts = quoteRows.filter((quote) => quote.status === "draft");
  const sent = quoteRows.filter((quote) => quote.status === "sent");
  const toInvoice = quoteRows.filter((quote) => quote.status === "accepted");
  const openWorks = workRows.filter((work) => work.status === "active");
  const immediateCount = urgentCases.length + drafts.length + toInvoice.length;

  return (
    <div className="space-y-10">
      <BinderPageHeader eyebrow="Votre atelier" title="Aujourd'hui" description="Les décisions, réponses et documents qui font avancer vos ouvrages." action={<Link to="/atelier/devis/nouveau" className={PRIMARY_BUTTON}>Nouveau devis</Link>} />

      <section aria-labelledby="now-heading" className="space-y-4">
        <BinderSectionTitle title="À traiter maintenant" detail="Classé par action, sans indicateur décoratif." count={immediateCount} />
        {immediateCount === 0 ? (
          <BinderEmptyState title="Votre journée est à jour" description="Aucune nouvelle demande, aucun message en attente et aucun devis à terminer." action={<Link to="/atelier/ouvrages" className="text-sm font-semibold text-[#5f1b27] underline underline-offset-4">Voir les ouvrages en cours</Link>} />
        ) : (
          <ul className="divide-y divide-[#d8d0c4] border-y border-[#cfc5b6] bg-[#fffdf8]">
            {urgentCases.slice(0, 8).map((row) => {
              const work = caseWork.get(row.caseId);
              const hasDraft = Boolean(work && drafts.some((quote) => quote.workId === work.id));
              const Icon = row.unreadCount > 0 ? MessageSquare : Inbox;
              return (
                <li key={row.caseId}>
                  <Link to="/atelier/leads/$leadId" params={{ leadId: row.caseId }} className="group grid min-h-24 gap-3 px-4 py-4 transition hover:bg-[#f5f0e8] sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center sm:px-5">
                    <span className="hidden h-8 w-8 items-center justify-center rounded-full border border-[#cfc5b6] text-[#7a2230] sm:flex"><Icon aria-hidden="true" className="h-4 w-4" /></span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2"><strong className="font-editorial text-lg font-normal text-[#241a12]">{row.title}</strong>{row.unreadCount > 0 && <span className="rounded-full bg-[#7a2230] px-2 py-0.5 text-[0.65rem] font-bold text-white">{row.unreadCount} nouveau</span>}</span>
                      <span className="mt-1 block truncate text-xs text-[#74695d]">{row.clientName || "Projet Ma Reliure"} · {row.reference}</span>
                      <span className="mt-2 block text-sm font-medium text-[#4b3829]">{nextCaseAction(row, Boolean(work), hasDraft)}</span>
                    </span>
                    <span className="text-sm font-semibold text-[#5f1b27] underline decoration-[#7a2230]/30 underline-offset-4 group-hover:decoration-current">Ouvrir</span>
                  </Link>
                </li>
              );
            })}
            {drafts.slice(0, 4).map((quote) => (
              <li key={quote.id}>
                <Link to="/atelier/devis/$quoteId/modifier" params={{ quoteId: quote.id }} className="group grid min-h-24 gap-3 px-4 py-4 transition hover:bg-[#f5f0e8] sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center sm:px-5">
                  <span className="hidden h-8 w-8 items-center justify-center rounded-full border border-[#cfc5b6] text-[#7a2230] sm:flex"><FilePenLine aria-hidden="true" className="h-4 w-4" /></span>
                  <span><span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#7a2230]">Devis à terminer</span><strong className="mt-1 block font-editorial text-lg font-normal">{quote.bookTitle || quote.clientName}</strong><span className="mt-1 block text-xs text-[#74695d]">{quote.number} · {quote.clientName}</span></span>
                  <span className="text-sm font-semibold text-[#5f1b27] underline decoration-[#7a2230]/30 underline-offset-4 group-hover:decoration-current">Continuer</span>
                </Link>
              </li>
            ))}
            {toInvoice.slice(0, 3).map((quote) => (
              <li key={quote.id}>
                <Link to="/atelier/devis/$quoteId" params={{ quoteId: quote.id }} className="group grid min-h-24 gap-3 px-4 py-4 transition hover:bg-[#f5f0e8] sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center sm:px-5">
                  <span className="hidden h-8 w-8 items-center justify-center rounded-full border border-[#cfc5b6] text-[#7a2230] sm:flex"><CircleCheck aria-hidden="true" className="h-4 w-4" /></span>
                  <span><span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#7a2230]">Devis accepté</span><strong className="mt-1 block font-editorial text-lg font-normal">{quote.bookTitle || quote.clientName}</strong><span className="mt-1 block text-xs text-[#74695d]">Préparer la facture · {quote.number}</span></span>
                  <span className="text-sm font-semibold text-[#5f1b27] underline decoration-[#7a2230]/30 underline-offset-4 group-hover:decoration-current">Facturer</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="follow-heading" className="space-y-4">
        <BinderSectionTitle title="À suivre" detail="Les dossiers qui avancent sans action immédiate." />
        <div className="grid divide-y divide-[#d8d0c4] border-y border-[#cfc5b6] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <Link to="/atelier/devis" className="px-4 py-5 hover:bg-[#f0e9df]"><strong className="block text-2xl font-normal tabular-nums">{sent.length}</strong><span className="mt-1 block text-sm text-[#685d51]">devis envoyé{sent.length > 1 ? "s" : ""}</span></Link>
          <Link to="/atelier/ouvrages" className="px-4 py-5 hover:bg-[#f0e9df]"><strong className="block text-2xl font-normal tabular-nums">{openWorks.length}</strong><span className="mt-1 block text-sm text-[#685d51]">ouvrage{openWorks.length > 1 ? "s" : ""} en cours</span></Link>
          <Link to="/atelier/messages" className="px-4 py-5 hover:bg-[#f0e9df]"><strong className="block text-2xl font-normal tabular-nums">{urgentCases.reduce((total, row) => total + row.unreadCount, 0)}</strong><span className="mt-1 block text-sm text-[#685d51]">message{urgentCases.reduce((total, row) => total + row.unreadCount, 0) > 1 ? "s" : ""} non lu{urgentCases.reduce((total, row) => total + row.unreadCount, 0) > 1 ? "s" : ""}</span></Link>
        </div>
      </section>
    </div>
  );
}
