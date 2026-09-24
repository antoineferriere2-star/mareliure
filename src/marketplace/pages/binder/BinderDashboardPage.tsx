/**
 * La page d'arrivée répond à une question : qu'est-ce qui mérite mon attention maintenant ?
 *
 * Chaque source (demandes, devis, factures, ouvrages, profils) se charge et
 * échoue indépendamment : une panne des factures ne masque pas un message
 * client. Aucun chiffre n'est affiché sans venir d'une donnée lue — une source
 * indisponible s'affiche « — », jamais 0.
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
import { INVOICES_KEY, PROFILE_QUERY_KEY, QUOTES_KEY } from "@/marketplace/pages/binder/quotes/quoteQueryKeys";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/marketplace/pages/binder/quotes/quoteUi";
import { WORKS_KEY } from "@/marketplace/pages/binder/works/workKeys";
import { Skeleton } from "@/components/ui/skeleton";
import { BinderEmptyState, BinderPageHeader, BinderRetryNote, BinderSectionTitle } from "./BinderPageUi";

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

const SOURCE_NAMES = { cases: "demandes et messages", quotes: "devis", invoices: "factures", works: "ouvrages" } as const;

export function BinderDashboardPage() {
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

  return (
    <div className="space-y-9 sm:space-y-10">
      <BinderPageHeader
        eyebrow={longDate(new Date())}
        title="Aujourd'hui"
        description="Ce qui attend une réponse, une décision ou un document, dans l'ordre où le traiter."
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/atelier/devis/nouveau" className={PRIMARY_BUTTON}>Nouveau devis</Link>
            <Link to="/atelier/ouvrages/nouveau" className={SECONDARY_BUTTON}>Nouvel ouvrage</Link>
          </div>
        }
      />

      <section aria-labelledby="overview-heading">
        <h2 id="overview-heading" className="sr-only">Vue d'ensemble</h2>
        <ul className="grid grid-cols-2 gap-px overflow-hidden border border-[#cfc5b6] bg-[#cfc5b6] lg:grid-cols-5 [&>li:last-child]:col-span-2 lg:[&>li:last-child]:col-span-1">
          <SummaryTile to="/atelier/leads" query={cases} value={summary.newRequests} label={plural(summary.newRequests, "nouvelle demande", "nouvelles demandes")} hint={summary.newRequests ? "à examiner" : "aucune en attente"} urgent={Boolean(summary.newRequests)} />
          <SummaryTile to="/atelier/messages" query={cases} value={summary.unreadMessages} label={plural(summary.unreadMessages, "message non lu", "messages non lus")} hint={summary.unreadMessages ? "réponse attendue" : "vous êtes à jour"} urgent={Boolean(summary.unreadMessages)} />
          <SummaryTile to="/atelier/devis" query={quotes} value={summary.sentQuotes} label={plural(summary.sentQuotes, "devis envoyé", "devis envoyés")} hint={summary.quotesToFollowUp ? `${summary.quotesToFollowUp} à relancer` : "aucune relance nécessaire"} urgent={Boolean(summary.quotesToFollowUp)} />
          <SummaryTile to="/atelier/ouvrages" query={works} value={summary.activeWorks} label={plural(summary.activeWorks, "ouvrage en cours", "ouvrages en cours")} hint="fiches actives à l'atelier" urgent={false} />
          <SummaryTile to="/atelier/factures" query={invoices} value={summary.awaitingPayment} label={plural(summary.awaitingPayment, "paiement attendu", "paiements attendus")} hint={summary.overduePayments ? `dont ${summary.overduePayments} en retard` : "aucun retard"} urgent={Boolean(summary.overduePayments)} />
        </ul>
      </section>

      <div className="grid gap-9 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start xl:gap-12">
        <section aria-labelledby="now-heading" aria-busy={loading} className="min-w-0 space-y-4">
          <BinderSectionTitle
            id="now-heading"
            title="À traiter maintenant"
            detail={
              loading
                ? "Chargement de vos priorités…"
                : agenda.length === 0
                  ? undefined
                  : `${agenda.length} action${agenda.length > 1 ? "s" : ""}${lateCount ? `, dont ${lateCount} en retard` : ""} — les clients qui attendent une réponse d'abord.`
            }
          />
          {failed.length > 0 && (
            <BinderRetryNote onRetry={retryFailed} retrying={retrying}>
              Impossible de charger : {failed.map((key) => SOURCE_NAMES[key]).join(", ")}. La liste peut être incomplète.
            </BinderRetryNote>
          )}
          {loading ? (
            <AgendaSkeleton />
          ) : agenda.length === 0 ? (
            failed.length > 0 ? null : (
              <BinderEmptyState
                title="Rien ne vous attend"
                description="Aucune demande nouvelle, aucun message non lu, aucun devis à relancer ni facture à émettre."
                action={<Link to="/atelier/ouvrages" className={`inline-flex min-h-11 items-center text-sm font-semibold text-[#5f1b27] underline underline-offset-4 ${FOCUS}`}>Voir les ouvrages en cours</Link>}
              />
            )
          ) : (
            <>
              <ol id="today-agenda" className="divide-y divide-[#d8d0c4] border-y border-[#cfc5b6] bg-[#fffdf8]">
                {visible.map((item) => <AgendaRow key={item.key} item={item} />)}
              </ol>
              {agenda.length > AGENDA_PREVIEW && (
                <button type="button" aria-expanded={expanded} aria-controls="today-agenda" onClick={() => setExpanded((value) => !value)} className={`inline-flex min-h-11 items-center rounded-sm text-sm font-semibold text-[#5f1b27] underline underline-offset-4 ${FOCUS}`}>
                  {expanded ? "Afficher moins" : `Afficher ${hidden > 1 ? `les ${hidden} autres actions` : "l'action suivante"}`}
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
  to,
  query,
  value,
  label,
  hint,
  urgent,
}: {
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
            <span className="sr-only">Chargement…</span>
            <Skeleton className="h-8 w-10" />
            <Skeleton className="h-4 w-28" />
          </>
        ) : value === null ? (
          <>
            <strong aria-hidden="true" className="font-editorial text-3xl font-normal leading-none text-[#74695d]">—</strong>
            <span className="text-sm leading-5 text-[#3f3228]">
              {label}
              <span className="mt-0.5 block text-xs text-[#74695d]">donnée indisponible</span>
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

function AgendaRow({ item }: { item: AgendaItem }) {
  const Icon = KIND_ICONS[item.kind];
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
            {item.label}
            {item.late && <span className="rounded-sm border border-current px-1.5 py-px text-[0.6rem] tracking-[0.1em]">En retard</span>}
          </span>
          <strong className="mt-1 block truncate font-editorial text-lg font-normal leading-snug text-[#241a12]">{item.title}</strong>
          <span className="mt-0.5 block truncate text-xs text-[#685d51]">{item.detail}</span>
        </span>
        <span className="col-start-2 inline-flex min-h-11 items-center text-sm font-semibold text-[#5f1b27] underline decoration-[#7a2230]/35 underline-offset-4 group-hover:decoration-current sm:col-start-3 sm:min-h-0">
          {item.action}
        </span>
      </Link>
    </li>
  );
}

function AgendaSkeleton() {
  return (
    <div role="status" className="divide-y divide-[#d8d0c4] border-y border-[#cfc5b6] bg-[#fffdf8]">
      <span className="sr-only">Chargement de vos priorités…</span>
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
      <BinderSectionTitle id="setup-heading" title="Votre atelier" />
      <ul className="divide-y divide-[#d8d0c4] border border-[#cfc5b6] bg-[#fffdf8]">
        <SetupRow
          title="Accès aux demandes"
          query={binder}
          state={approved ? "ready" : "waiting"}
          status={approved ? "Actif" : "En attente"}
          detail={approved ? "Ma Reliure peut vous confier des projets." : "Ma Reliure active l'accès depuis l'administration. Devis, ouvrages et contacts restent disponibles."}
          onRetry={() => void binder.refetch()}
        />
        <SetupRow
          title="Devis et factures"
          query={billing}
          state={invoiceReadiness?.ready ? "ready" : "todo"}
          status={invoiceReadiness?.ready ? "Prêt" : quoteReadiness?.ready ? "Factures bloquées" : "À compléter"}
          detail={invoiceReadiness?.ready ? "Vos informations légales permettent d'émettre devis et factures." : `Manquant : ${(invoiceReadiness?.missing ?? []).join(", ")}.`}
          link={invoiceReadiness?.ready ? undefined : { to: "/atelier/tarifs", label: "Compléter mes informations" }}
          onRetry={() => void billing.refetch()}
        />
        <SetupRow
          title="Profil public"
          query={publicProfile}
          state={published ? "ready" : "todo"}
          status={published ? "Publié" : publicMissing.length ? "À compléter" : "Non publié"}
          detail={
            published
              ? "Votre page présente votre savoir-faire."
              : publicMissing.length
                ? `Manquant : ${publicMissing.join(", ")}.`
                : approved
                  ? "Votre profil est prêt : il ne reste qu'à le publier."
                  : "Votre profil est prêt ; il pourra être publié une fois l'atelier approuvé."
          }
          link={{ to: "/atelier/profil-public", label: published ? "Modifier mon profil" : "Terminer mon profil" }}
          onRetry={() => void publicProfile.refetch()}
        />
      </ul>
    </section>
  );
}

function SetupRow({
  title,
  query,
  state,
  status,
  detail,
  link,
  onRetry,
}: {
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
          Information indisponible.{" "}
          <button type="button" onClick={onRetry} className={`inline-flex min-h-11 items-center font-semibold underline underline-offset-4 ${FOCUS}`}>Réessayer</button>
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

function plural(value: number | null, one: string, many: string): string {
  return value !== null && value > 1 ? many : one;
}

function longDate(now: Date): string {
  const text = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(now);
  return text.charAt(0).toUpperCase() + text.slice(1);
}
