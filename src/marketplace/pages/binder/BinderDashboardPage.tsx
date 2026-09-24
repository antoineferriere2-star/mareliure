/**
 * La page d'arrivée répond à une question : qu'est-ce qui mérite mon attention maintenant ?
 *
 * Chaque source (demandes, devis, factures, ouvrages, profils) se charge et
 * échoue indépendamment : une panne des factures ne masque pas un message
 * client. Aucun chiffre n'est affiché sans venir d'une donnée lue — une source
 * indisponible s'affiche « — », jamais 0.
 *
 * Ma Reliure reste en français ; un atelier FineBindery lit la page dans sa langue
 * (`dashboardCopy.ts`), comme la navigation de l'espace atelier.
 */
import { useState, type ComponentType } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BookOpen,
  CircleAlert,
  CircleCheck,
  Clock,
  FilePenLine,
  FilePlus2,
  Inbox,
  MessageSquare,
  ReceiptText,
} from "lucide-react";
import { getMyBinderProfile, listMyBinderCases } from "@/marketplace/services/marketplace.data.functions";
import { getBillingProfile, getMyInvoices, getMyQuotes } from "@/marketplace/services/binderQuotes.data.functions";
import { getMyWorks } from "@/marketplace/services/binderWorks.data.functions";
import { getMyFineBinderyProfile } from "@/marketplace/services/fineBinderyProfile.data.functions";
import { profileReadiness } from "@/marketplace/quotes/quoteBuild";
import { todayInParis } from "@/marketplace/quotes/quoteStatus";
import { buildAgenda, summarize, type AgendaItem, type AgendaKind } from "@/marketplace/binders/todayAgenda";
import { useFineBinderyWorkspace } from "@/marketplace/i18n/FineBinderyWorkspaceContext";
import type { FineBinderyLocale } from "@/marketplace/i18n/fineBinderyLocale";
import { INVOICES_KEY, PROFILE_QUERY_KEY, QUOTES_KEY } from "@/marketplace/pages/binder/quotes/quoteQueryKeys";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/marketplace/pages/binder/quotes/quoteUi";
import { WORKS_KEY } from "@/marketplace/pages/binder/works/workKeys";
import { Skeleton } from "@/components/ui/skeleton";
import { BinderEmptyState, BinderPageHeader, BinderRetryNote, BinderSectionTitle } from "./BinderPageUi";
import { agendaTexts, dashboardCopy, longDate, translateMissing, type DashboardCopy } from "./dashboardCopy";

/** Les mêmes clés que la navigation et les écrans détaillés : une écriture ailleurs rafraîchit aussi cette page. */
const CASES_KEY = ["marketplace", "binder", "cases"] as const;
const BINDER_PROFILE_KEY = ["marketplace", "binder", "profile"] as const;
const PUBLIC_PROFILE_KEY = ["marketplace", "binder", "public-profile"] as const;

/** Au-delà, la liste se replie : l'écran reste un point de départ, pas une seconde boîte de réception. */
const AGENDA_PREVIEW = 6;

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a2230]/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f4efe6]";

const KIND_ICONS: Record<AgendaKind, ComponentType<{ className?: string; "aria-hidden"?: "true" }>> = {
  message: MessageSquare,
  request: Inbox,
  payment_overdue: CircleAlert,
  case_work: BookOpen,
  case_quote: FilePlus2,
  quote_expired: Clock,
  quote_expiring: Clock,
  quote_draft: FilePenLine,
  quote_to_invoice: CircleCheck,
  invoice_draft: ReceiptText,
};

/** La langue de la page : celle de l'atelier FineBindery, sinon le français de Ma Reliure. */
function useDashboardLanguage() {
  const { isFineBindery, locale } = useFineBinderyWorkspace();
  const language: FineBinderyLocale = isFineBindery ? locale : "fr";
  return { locale: language, t: dashboardCopy(language), brand: isFineBindery ? "FineBindery" : "Ma Reliure" };
}

export function BinderDashboardPage() {
  const { locale, t } = useDashboardLanguage();
  const fetchCases = useServerFn(listMyBinderCases);
  const fetchQuotes = useServerFn(getMyQuotes);
  const fetchInvoices = useServerFn(getMyInvoices);
  const fetchWorks = useServerFn(getMyWorks);
  const cases = useQuery({ queryKey: CASES_KEY, queryFn: () => fetchCases() });
  const quotes = useQuery({ queryKey: QUOTES_KEY, queryFn: () => fetchQuotes() });
  const invoices = useQuery({ queryKey: INVOICES_KEY, queryFn: () => fetchInvoices() });
  const works = useQuery({ queryKey: WORKS_KEY, queryFn: () => fetchWorks({ data: {} }) });
  const [expanded, setExpanded] = useState(false);

  const today = todayInParis();
  const sources = { cases, quotes, invoices, works } as const;
  const sourceKeys = Object.keys(sources) as (keyof typeof sources)[];
  const loading = sourceKeys.some((key) => sources[key].isPending);
  const failed = sourceKeys.filter((key) => sources[key].isError);
  const retrying = failed.some((key) => sources[key].isFetching);
  const retryFailed = () => void Promise.all(failed.map((key) => sources[key].refetch()));

  const agenda = loading
    ? []
    : buildAgenda({ cases: cases.data ?? [], quotes: quotes.data ?? [], invoices: invoices.data ?? [], works: works.data ?? [], today });
  const summary = summarize({
    cases: cases.data ?? null,
    quotes: quotes.data ?? null,
    invoices: invoices.data ?? null,
    works: works.data ?? null,
    today,
  });
  const visible = expanded ? agenda : agenda.slice(0, AGENDA_PREVIEW);
  const hidden = agenda.length - visible.length;
  const lateCount = agenda.filter((item) => item.late).length;
  const tiles = t.tiles;

  return (
    <div className="space-y-9 sm:space-y-10">
      <BinderPageHeader
        eyebrow={longDate(new Date(), locale)}
        title={t.title}
        description={t.description}
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/atelier/devis/nouveau" className={PRIMARY_BUTTON}>{t.newQuote}</Link>
            <Link to="/atelier/ouvrages/nouveau" className={SECONDARY_BUTTON}>{t.newWork}</Link>
          </div>
        }
      />

      <section aria-labelledby="overview-heading">
        <h2 id="overview-heading" className="sr-only">{t.overview}</h2>
        <ul className="grid grid-cols-2 gap-px overflow-hidden border border-[#cfc5b6] bg-[#cfc5b6] lg:grid-cols-5 [&>li:last-child]:col-span-2 lg:[&>li:last-child]:col-span-1">
          <SummaryTile t={t} to="/atelier/leads" query={cases} value={summary.newRequests} label={tiles.requests(summary.newRequests)} hint={tiles.requestsHint(summary.newRequests ?? 0)} urgent={Boolean(summary.newRequests)} />
          <SummaryTile t={t} to="/atelier/messages" query={cases} value={summary.unreadMessages} label={tiles.messages(summary.unreadMessages)} hint={tiles.messagesHint(summary.unreadMessages ?? 0)} urgent={Boolean(summary.unreadMessages)} />
          <SummaryTile t={t} to="/atelier/devis" query={quotes} value={summary.sentQuotes} label={tiles.sent(summary.sentQuotes)} hint={tiles.sentHint(summary.quotesToFollowUp ?? 0)} urgent={Boolean(summary.quotesToFollowUp)} />
          <SummaryTile t={t} to="/atelier/ouvrages" query={works} value={summary.activeWorks} label={tiles.works(summary.activeWorks)} hint={tiles.worksHint} urgent={false} />
          <SummaryTile t={t} to="/atelier/factures" query={invoices} value={summary.awaitingPayment} label={tiles.payments(summary.awaitingPayment)} hint={tiles.paymentsHint(summary.overduePayments ?? 0)} urgent={Boolean(summary.overduePayments)} />
        </ul>
      </section>

      <div className="grid gap-9 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start xl:gap-12">
        <section aria-labelledby="now-heading" aria-busy={loading} className="min-w-0 space-y-4">
          <BinderSectionTitle
            id="now-heading"
            title={t.now.title}
            detail={loading ? t.now.loading : agenda.length === 0 ? undefined : t.now.summary(agenda.length, lateCount)}
          />
          {failed.length > 0 && (
            <BinderRetryNote onRetry={retryFailed} retrying={retrying} labels={{ retry: t.now.retry, retrying: t.now.retrying }}>
              {t.now.failed(failed.map((key) => t.now.sources[key]).join(", "))}
            </BinderRetryNote>
          )}
          {loading ? (
            <AgendaSkeleton label={t.now.loading} />
          ) : agenda.length === 0 ? (
            failed.length > 0 ? null : (
              <BinderEmptyState
                title={t.now.emptyTitle}
                description={t.now.emptyBody}
                action={<Link to="/atelier/ouvrages" className={`inline-flex min-h-11 items-center text-sm font-semibold text-[#5f1b27] underline underline-offset-4 ${FOCUS}`}>{t.now.emptyLink}</Link>}
              />
            )
          ) : (
            <>
              <ol id="today-agenda" className="divide-y divide-[#d8d0c4] border-y border-[#cfc5b6] bg-[#fffdf8]">
                {visible.map((item) => <AgendaRow key={item.key} item={item} locale={locale} lateLabel={t.now.late} />)}
              </ol>
              {agenda.length > AGENDA_PREVIEW && (
                <button type="button" aria-expanded={expanded} aria-controls="today-agenda" onClick={() => setExpanded((value) => !value)} className={`inline-flex min-h-11 items-center rounded-sm text-sm font-semibold text-[#5f1b27] underline underline-offset-4 ${FOCUS}`}>
                  {expanded ? t.now.less : t.now.more(hidden)}
                </button>
              )}
            </>
          )}
        </section>

        <WorkshopSetup />
      </div>
    </div>
  );
}

function SummaryTile({
  t,
  to,
  query,
  value,
  label,
  hint,
  urgent,
}: {
  t: DashboardCopy;
  to: "/atelier/leads" | "/atelier/messages" | "/atelier/devis" | "/atelier/ouvrages" | "/atelier/factures";
  query: UseQueryResult<unknown>;
  value: number | null;
  label: string;
  hint: string;
  urgent: boolean;
}) {
  return (
    <li className="bg-[#fffdf8]">
      <Link to={to} className={`group flex h-full min-h-28 flex-col justify-between gap-3 px-4 py-4 transition hover:bg-[#f5f0e8] sm:px-5 ${urgent ? "shadow-[inset_0_3px_0_#7a2230]" : ""} ${FOCUS} focus-visible:ring-inset`}>
        {query.isPending ? (
          <>
            <span className="sr-only">{t.tiles.loading}</span>
            <Skeleton className="h-8 w-10" />
            <Skeleton className="h-4 w-28" />
          </>
        ) : value === null ? (
          <>
            <strong aria-hidden="true" className="font-editorial text-3xl font-normal leading-none text-[#74695d]">—</strong>
            <span className="text-sm leading-5 text-[#3f3228]">
              {label}
              <span className="mt-0.5 block text-xs text-[#74695d]">{t.tiles.unavailable}</span>
            </span>
          </>
        ) : (
          <>
            <strong className={`font-editorial text-3xl font-normal leading-none tabular-nums ${urgent ? "text-[#5f1b27]" : "text-[#241a12]"}`}>{value}</strong>
            <span className="text-sm leading-5 text-[#3f3228]">
              {label}
              <span className={`mt-0.5 block text-xs ${urgent ? "font-semibold text-[#5f1b27]" : "text-[#685d51]"}`}>{hint}</span>
            </span>
          </>
        )}
      </Link>
    </li>
  );
}

function AgendaRow({ item, locale, lateLabel }: { item: AgendaItem; locale: FineBinderyLocale; lateLabel: string }) {
  const Icon = KIND_ICONS[item.kind];
  const text = agendaTexts(item, locale);
  return (
    <li>
      <Link
        {...item.link}
        className={`group grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 gap-y-1 px-4 py-4 transition hover:bg-[#f5f0e8] sm:grid-cols-[2.25rem_minmax(0,1fr)_auto] sm:items-center sm:px-5 ${FOCUS} focus-visible:ring-inset`}
      >
        <span className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-full border sm:mt-0 ${item.late ? "border-[#9a3412] bg-[#fdf1ea] text-[#9a3412]" : "border-[#cfc5b6] text-[#7a2230]"}`}>
          <Icon aria-hidden="true" className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className={`flex flex-wrap items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] ${item.late ? "text-[#9a3412]" : "text-[#7a2230]"}`}>
            {text.label}
            {item.late && <span className="rounded-sm border border-current px-1.5 py-px text-[0.6rem] tracking-[0.1em]">{lateLabel}</span>}
          </span>
          <strong className="mt-1 block truncate font-editorial text-lg font-normal leading-snug text-[#241a12]">{text.title}</strong>
          <span className="mt-0.5 block truncate text-xs text-[#685d51]">{text.detail}</span>
        </span>
        <span className="col-start-2 inline-flex min-h-11 items-center text-sm font-semibold text-[#5f1b27] underline decoration-[#7a2230]/35 underline-offset-4 group-hover:decoration-current sm:col-start-3 sm:min-h-0">
          {text.action}
        </span>
      </Link>
    </li>
  );
}

function AgendaSkeleton({ label }: { label: string }) {
  return (
    <div role="status" className="divide-y divide-[#d8d0c4] border-y border-[#cfc5b6] bg-[#fffdf8]">
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((index) => (
        <div key={index} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 px-4 py-4 sm:px-5">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

type SetupState = "ready" | "todo" | "waiting";

/** L'état de l'atelier : ce qui conditionne l'accès aux demandes, la facturation et la page publique. */
function WorkshopSetup() {
  const { t: copy, brand } = useDashboardLanguage();
  const t = copy.setup;
  const fetchBinder = useServerFn(getMyBinderProfile);
  const fetchBilling = useServerFn(getBillingProfile);
  const fetchPublic = useServerFn(getMyFineBinderyProfile);
  const binder = useQuery({ queryKey: BINDER_PROFILE_KEY, queryFn: () => fetchBinder() });
  const billing = useQuery({ queryKey: PROFILE_QUERY_KEY, queryFn: () => fetchBilling() });
  const publicProfile = useQuery({ queryKey: PUBLIC_PROFILE_KEY, queryFn: () => fetchPublic() });

  const approved = binder.data?.status === "approved";
  const invoiceReadiness = billing.data ? profileReadiness(billing.data, "invoice") : null;
  const quoteReadiness = billing.data ? profileReadiness(billing.data, "quote") : null;
  const published = publicProfile.data?.profileStatus === "published";
  const publicMissing = publicProfile.data?.missing ?? [];

  return (
    <section aria-labelledby="setup-heading" className="space-y-4">
      <BinderSectionTitle id="setup-heading" title={t.title} />
      <ul className="divide-y divide-[#d8d0c4] border border-[#cfc5b6] bg-[#fffdf8]">
        <SetupRow
          t={t}
          title={t.access}
          query={binder}
          state={approved ? "ready" : "waiting"}
          status={approved ? t.active : t.waiting}
          detail={approved ? t.accessOn(brand) : t.accessOff(brand)}
          onRetry={() => void binder.refetch()}
        />
        <SetupRow
          t={t}
          title={t.billing}
          query={billing}
          state={invoiceReadiness?.ready ? "ready" : "todo"}
          status={invoiceReadiness?.ready ? t.ready : quoteReadiness?.ready ? t.invoicesBlocked : t.toComplete}
          detail={invoiceReadiness?.ready ? t.billingReady : t.missing(translateMissing(invoiceReadiness?.missing ?? [], copy))}
          link={invoiceReadiness?.ready ? undefined : { to: "/atelier/tarifs", label: t.completeLink }}
          onRetry={() => void billing.refetch()}
        />
        <SetupRow
          t={t}
          title={t.publicProfile}
          query={publicProfile}
          state={published ? "ready" : "todo"}
          status={published ? t.published : publicMissing.length ? t.toComplete : t.notPublished}
          detail={
            published
              ? t.publishedBody
              : publicMissing.length
                ? t.missing(translateMissing(publicMissing, copy))
                : approved
                  ? t.readyToPublish
                  : t.readyAfterApproval
          }
          link={{ to: "/atelier/profil-public", label: published ? t.editProfile : t.finishProfile }}
          onRetry={() => void publicProfile.refetch()}
        />
      </ul>
    </section>
  );
}

function SetupRow({
  t,
  title,
  query,
  state,
  status,
  detail,
  link,
  onRetry,
}: {
  t: DashboardCopy["setup"];
  title: string;
  query: UseQueryResult<unknown>;
  state: SetupState;
  status: string;
  detail: string;
  link?: { to: "/atelier/tarifs" | "/atelier/profil-public"; label: string };
  onRetry: () => void;
}) {
  const Icon = state === "ready" ? CircleCheck : state === "waiting" ? Clock : CircleAlert;
  return (
    <li className="px-4 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-[#241a12]">{title}</h3>
        {query.isSuccess && (
          <span className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold ${state === "ready" ? "text-[#166534]" : state === "waiting" ? "text-[#854d0e]" : "text-[#9a3412]"}`}>
            <Icon aria-hidden="true" className="h-3.5 w-3.5" />
            {status}
          </span>
        )}
      </div>
      {query.isPending ? (
        <Skeleton className="mt-2 h-4 w-3/4" />
      ) : query.isError ? (
        <p className="mt-1 text-xs leading-5 text-[#5a1f0c]">
          {t.unavailable}{" "}
          <button type="button" onClick={onRetry} className={`inline-flex min-h-11 items-center font-semibold underline underline-offset-4 ${FOCUS}`}>{t.retry}</button>
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs leading-5 text-[#685d51]">{detail}</p>
          {link && (
            <Link to={link.to} className={`mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-[#5f1b27] underline underline-offset-4 ${FOCUS}`}>
              {link.label}
            </Link>
          )}
        </>
      )}
    </li>
  );
}
