/**
 * Le détail d'un projet, vu du client.
 *
 * L'écran répond dans l'ordre aux questions qu'il se pose : de quoi s'agit-il,
 * où en est-il, qu'est-ce que je dois faire, combien, puis seulement les
 * détails. Le bouton principal d'une action attendue (payer, répondre) est
 * dans la zone « Prochaine étape », en haut — jamais enfoui sous le Brief.
 *
 * Rien ici ne décide de ce qui est payable, de ce qui est acceptable, de ce qui
 * est visible ou de qui peut écrire : le serveur renvoie des faits déjà arbitrés
 * (`paymentEligible`, `canAcceptProposal`, `messagingChannel`, une vue de
 * proposition en liste blanche, un `CaseView` déjà filtré) et cet écran les met
 * en page. Aucun message d'erreur du serveur n'est affiché.
 */
import { CustomerOppeDocuments } from "./CustomerOppeDocuments";
import { WorkshopCustomerCasePage } from "./WorkshopCustomerCasePage";
import { ORDER_STAGE_LABELS } from "@/marketplace/orders/orderStatus";
import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { getMyCustomerCase } from "@/marketplace/services/marketplace.data.functions";
import { createCommercialCheckoutSession } from "@/marketplace/stripe/checkoutSession.server";
import { acceptMyProposal } from "@/marketplace/services/customerProposalAcceptance.data.functions";
import { ConversationPanel } from "@/marketplace/pages/ConversationPanel";
import { DecisionsPanel } from "@/marketplace/pages/DecisionsPanel";
import { binderSkillLabel, binderSkillLabelEn } from "@/marketplace/binders/skills";
import { formatEuros } from "@/marketplace/pricing/money";
import type { CustomerProposalView } from "@/marketplace/commercial/customerProposalView";
import {
  customerCopy,
  customerLocaleForBrand,
  customerNextStep,
  customerStatus,
  customerTimeline,
  formatCustomerDate,
  pricingModeLabel,
  presentBriefLines,
  type CustomerCaseFacts,
  type CustomerCopy,
  type CustomerLocale,
  type NextStep,
} from "@/marketplace/customer/customerPresentation";
import type { MarketplaceBrand } from "@/marketplace/brand/brandConfig";
import { Button } from "@/components/ui/button";
import { CoverPhoto, CustomerPhotoGallery } from "./CustomerPhotoGallery";
import { PortalDetailSkeleton, PortalError, StatusBadge } from "./CustomerPortalUi";
import { CustomerLogisticsPanel, LogisticsActionBanner, useLogisticsCustomerAction } from "./CustomerLogisticsPanel";

const CARD = "rounded-2xl border border-[#3b2a1d]/15 bg-[#fdfaf3] p-5 sm:p-6";

/**
 * Le seul déclencheur d'un Checkout réel — appelle uniquement la server
 * function existante (§11 du brief du 17 septembre 2026), qui recharge la
 * proposition acceptée et fige le montant côté serveur. Le navigateur ne
 * transmet jamais de montant, ici pas même un `caseId` de plus que celui déjà
 * affiché. L'erreur, elle, n'est jamais celle de Stripe ou du serveur.
 */
function PayButton({ caseId, copy }: { caseId: string; copy: CustomerCopy }) {
  const createSession = useServerFn(createCommercialCheckoutSession);
  const [failed, setFailed] = useState(false);
  const pay = useMutation({
    mutationFn: () => createSession({ data: { caseId } }),
    onSuccess: (result) => {
      window.location.href = result.url;
    },
    onError: () => setFailed(true),
  });

  return (
    <div>
      <Button
        size="lg"
        data-primary-action=""
        className="h-11 w-full sm:w-auto"
        disabled={pay.isPending}
        onClick={() => {
          setFailed(false);
          pay.mutate();
        }}
      >
        {pay.isPending ? copy.payRedirecting : copy.payLabel}
      </Button>
      {failed && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {copy.payError}
        </p>
      )}
    </div>
  );
}

/**
 * Accepter la proposition affichée. Le navigateur n'envoie que deux identifiants
 * (le dossier, et la proposition qu'il a sous les yeux) : jamais un montant.
 * Le serveur revérifie que ce client est le propriétaire, que cette proposition
 * est toujours la dernière et acceptable, puis écrit ; la possibilité de payer
 * est recalculée côté serveur, et l'écran la relit — il ne la suppose pas.
 *
 * Le bouton reste « en cours » jusqu'à ce que le dossier relu montre le nouvel
 * état : pas de clignotement où « Accepter » réapparaîtrait avant « Payer ».
 * L'erreur n'est jamais celle du serveur ; et comme l'équipe a pu réviser la
 * proposition entre-temps, l'écran relit ce que le serveur présente maintenant.
 */
function AcceptButton({
  caseId,
  proposalId,
  copy,
  onAccepted,
}: {
  caseId: string;
  proposalId: string;
  copy: CustomerCopy;
  onAccepted: () => void;
}) {
  const accept = useServerFn(acceptMyProposal);
  const queryClient = useQueryClient();
  const [failed, setFailed] = useState(false);
  const [consent, setConsent] = useState(false);
  const [billing, setBilling] = useState({ name: "", addressLine1: "", postalCode: "", city: "", country: copy.billingDefaultCountry });
  const billingComplete =
    billing.name.trim() !== "" && billing.addressLine1.trim() !== "" && billing.postalCode.trim() !== "" &&
    billing.city.trim() !== "" && /^[A-Za-z]{2}$/.test(billing.country.trim());
  const field = (key: keyof typeof billing, label: string) => (
    <label className="block text-sm">
      <span className="text-[#6b5847]">{label}</span>
      <input
        className="mt-1 h-10 w-full rounded-md border border-[#cfc5b6] bg-white px-3 text-sm"
        value={billing[key]}
        maxLength={key === "country" ? 2 : 200}
        onChange={(event) => setBilling((current) => ({ ...current, [key]: event.target.value }))}
      />
    </label>
  );
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["marketplace", "customer", "case", caseId] }),
      queryClient.invalidateQueries({ queryKey: ["marketplace", "customer", "cases"] }),
    ]);
  const mutation = useMutation({
    mutationFn: () =>
      accept({ data: { caseId, proposalId, termsAccepted: true, billing: { ...billing, country: billing.country.trim().toUpperCase() } } }),
    onSuccess: async () => {
      setFailed(false);
      await refresh();
      onAccepted();
    },
    onError: async () => {
      setFailed(true);
      await refresh();
    },
  });

  return (
    <div>
      <fieldset className="mb-4 grid gap-3 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-semibold text-[#241a12]">{copy.billingTitle}</legend>
        <div className="sm:col-span-2">{field("name", copy.billingName)}</div>
        <div className="sm:col-span-2">{field("addressLine1", copy.billingAddress)}</div>
        {field("postalCode", copy.billingPostalCode)}
        {field("city", copy.billingCity)}
        {field("country", copy.billingCountry)}
      </fieldset>
      <label className="mb-3 flex items-start gap-3 text-sm leading-6">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 shrink-0"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
        />
        <span>
          {copy.termsConsent}{" "}
          <a href={copy.termsHref} target="_blank" rel="noreferrer" className="underline">
            {copy.termsLinkLabel}
          </a>
        </span>
      </label>
      <Button
        size="lg"
        data-primary-action=""
        className="h-11 w-full sm:w-auto"
        disabled={mutation.isPending || !consent || !billingComplete}
        onClick={() => {
          setFailed(false);
          mutation.mutate();
        }}
      >
        {mutation.isPending ? copy.acceptBusy : copy.acceptLabel}
      </Button>
      {failed && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {copy.acceptError}
        </p>
      )}
    </div>
  );
}

/** « Prochaine étape » : une phrase, et au plus un bouton principal. */
function NextStepCard({
  next,
  copy,
  locale,
  caseId,
  proposal,
  canPay,
  conciergeChannel,
  showMessageLink,
  logisticsActionPending,
}: {
  next: NextStep;
  copy: CustomerCopy;
  locale: CustomerLocale;
  caseId: string;
  proposal: CustomerProposalView | null;
  canPay: boolean;
  /** Fine Bindery : le client écrit à son concierge, jamais à l'atelier. */
  conciergeChannel: boolean;
  showMessageLink: boolean;
  /** Une action d'acheminement attend le client : « Aucune action requise » serait faux. */
  logisticsActionPending: boolean;
}) {
  const anchor = next.action === "decision" ? "#decisions" : next.action === "proposal" ? "#proposal" : null;
  const sectionRef = useRef<HTMLElement>(null);
  const [justAccepted, setJustAccepted] = useState(false);
  // Le bouton « Accepter » disparaît une fois la proposition acceptée : le focus
  // ne doit pas se perdre, il passe au bouton principal suivant (« Payer »).
  const handleAccepted = () => {
    setJustAccepted(true);
    setTimeout(() => sectionRef.current?.querySelector<HTMLElement>("[data-primary-action]")?.focus(), 0);
  };
  const total = proposal ? (proposal.totalTtcCents ?? proposal.totalHtCents) : null;
  return (
    <section
      ref={sectionRef}
      aria-labelledby="next-step-title"
      className={`rounded-2xl border p-5 sm:p-6 ${
        next.requiresAction ? "border-[#8a2e1f]/40 bg-[#fdf6f0]" : "border-[#3b2a1d]/15 bg-[#fdfaf3]"
      }`}
    >
      <h2
        id="next-step-title"
        className="text-xs font-semibold uppercase tracking-wide text-[#6b5847]"
      >
        {copy.nextStep}
      </h2>
      <p className="mt-2 font-serif text-xl leading-snug text-[#241a12]">{next.text}</p>
      {next.hint && !(logisticsActionPending && next.action === null) && (
        <p className="mt-2 text-sm text-[#6b5847]">{next.hint}</p>
      )}
      {next.action === "accept" && proposal && total !== null && (
        <p className="mt-2 text-sm text-[#4b3a2c]">
          {copy.acceptSummary(formatEuros(total, locale), proposal.totalTtcCents !== null)}
        </p>
      )}
      {/* Annonce l'acceptation aux lecteurs d'écran ; le texte visible ci-dessus change déjà. */}
      <div role="status" aria-live="polite" className="sr-only">
        {justAccepted ? copy.acceptedNotice : ""}
      </div>
      <div className="mt-4 flex flex-wrap items-start gap-3">
        {next.action === "accept" && proposal && (
          <AcceptButton caseId={caseId} proposalId={proposal.id} copy={copy} onAccepted={handleAccepted} />
        )}
        {next.action === "pay" && canPay && <PayButton caseId={caseId} copy={copy} />}
        {anchor && next.actionLabel && (
          <Button asChild size="lg" className="h-11">
            <a href={anchor}>{next.actionLabel}</a>
          </Button>
        )}
        {showMessageLink && (
          <Button asChild variant="outline" size="lg" className="h-11">
            <a href="#messages">{conciergeChannel ? copy.conciergeCta : copy.messageCta}</a>
          </Button>
        )}
      </div>
    </section>
  );
}

/** Les deux-points : précédés d'une espace en français, collés en anglais. */
function colon(locale: CustomerLocale): string {
  return locale === "fr-FR" ? " :" : ":";
}

function vatRateLabel(bps: number | null, locale: CustomerLocale): string | null {
  if (bps === null) return null;
  const percent = bps / 100;
  const text = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(percent);
  return locale === "fr-FR" ? `${text} %` : `${text}%`;
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-2 ${strong ? "border-t border-[#3b2a1d]/20 pt-3" : ""}`}>
      <dt className={strong ? "font-medium text-[#241a12]" : "text-sm text-[#6b5847]"}>{label}</dt>
      <dd className={strong ? "font-serif text-2xl text-[#241a12]" : "text-sm text-[#241a12]"}>{value}</dd>
    </div>
  );
}

/**
 * Votre proposition. Uniquement ce qu'un client a le droit de lire : service,
 * transport, HT, TVA, TTC. La rémunération de l'atelier, la marge et les
 * règles de prix ne sont pas dans la donnée reçue — le serveur ne les envoie pas.
 */
function ProposalCard({
  proposal,
  fallbackPriceCents,
  includes,
  paid,
  paymentEligible,
  canAccept,
  acceptSlot,
  copy,
  locale,
}: {
  proposal: CustomerProposalView | null;
  fallbackPriceCents: number | null;
  includes: readonly string[];
  paid: boolean;
  paymentEligible: boolean;
  /** Le client peut accepter cette proposition (verdict du serveur). */
  canAccept: boolean;
  /** Le bouton « Accepter » quand la zone « Prochaine étape » a déjà autre chose à demander. */
  acceptSlot: React.ReactNode;
  copy: CustomerCopy;
  locale: CustomerLocale;
}) {
  if (!proposal && fallbackPriceCents === null) return null;
  const acceptedOn = proposal?.confirmedAt ? formatCustomerDate(proposal.confirmedAt, locale) : null;
  const mode = pricingModeLabel(proposal?.pricingMode, locale);
  const fmt = (cents: number) => formatEuros(cents, locale);
  const showTax = proposal !== null && proposal.vatCents !== null && proposal.totalTtcCents !== null;
  const estimate =
    proposal?.pricingMode === "ESTIMATE_THEN_CONFIRM" &&
    proposal.estimateMinCents !== null &&
    proposal.estimateMaxCents !== null
      ? `${fmt(proposal.estimateMinCents)} – ${fmt(proposal.estimateMaxCents)}`
      : null;

  // « 100,00 € HT · 120,00 € TTC » quand la TVA s'applique ; le montant seul sinon.
  const withTtc = (cents: number) =>
    proposal && showTax && proposal.vatRateBps !== null
      ? `${fmt(cents)} ${locale === "en-US" ? "excl. tax" : "HT"} · ${fmt(Math.round((cents * (10_000 + proposal.vatRateBps)) / 10_000))} ${locale === "en-US" ? "incl. tax" : "TTC"}`
      : fmt(cents);
  // Taux distinct sur la ligne de transport (devis Oppe) : chaque ligne porte son propre taux.
  const shippingRateBps = proposal?.shippingVatRateBps ?? proposal?.vatRateBps ?? null;
  const shippingWithTtc = (cents: number) =>
    proposal && showTax && shippingRateBps !== null
      ? `${fmt(cents)} ${locale === "en-US" ? "excl. tax" : "HT"} · ${fmt(Math.round((cents * (10_000 + shippingRateBps)) / 10_000))} ${locale === "en-US" ? "incl. tax" : "TTC"}`
      : fmt(cents);
  const mixedRates = proposal?.shippingVatRateBps !== null && proposal?.shippingVatRateBps !== undefined;
  return (
    <section id="proposal" aria-labelledby="proposal-title" className={`${CARD} scroll-mt-6`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="proposal-title" className="font-serif text-2xl text-[#241a12]">
          {copy.yourProposal}
        </h2>
        {mode && (
          <p className="text-xs text-[#6b5847]">
            {copy.proposalPriceKind}{colon(locale)} <span className="font-medium text-[#241a12]">{mode}</span>
          </p>
        )}
      </div>

      {proposal ? (
        <dl className="mt-4">
          {/* Un particulier lit d'abord le TTC (recette du 4 octobre 2026) : chaque ligne
              soumise à TVA porte ses deux montants, comme la ligne transport. */}
          <Row label={copy.proposalService} value={withTtc(proposal.serviceCents)} />
          {proposal.shippingCents > 0 && (
            <Row
              label={proposal.shippingOfferKind === "book_round_trip_fr"
                ? (locale === "en-US" ? "Round-trip shipping" : "Transport aller-retour")
                : copy.proposalShipping}
              value={proposal.shippingOfferKind === "book_round_trip_fr" && showTax && shippingRateBps === 2000
                ? `${fmt(proposal.shippingCents)} ${locale === "en-US" ? "excl. tax" : "HT"} · ${fmt(1500)} ${locale === "en-US" ? "incl. tax" : "TTC"}`
                : shippingWithTtc(proposal.shippingCents)}
            />
          )}
          {showTax ? (
            <>
              <Row label={copy.proposalTotalHt} value={fmt(proposal.totalHtCents)} />
              <Row
                label={copy.proposalVat(mixedRates ? null : vatRateLabel(proposal.vatRateBps, locale))}
                value={fmt(proposal.vatCents ?? 0)}
              />
              <Row label={copy.proposalTotalTtc} value={fmt(proposal.totalTtcCents ?? 0)} strong />
            </>
          ) : (
            <Row label={copy.proposalTotalHt} value={fmt(proposal.totalHtCents)} strong />
          )}
        </dl>
      ) : (
        <dl className="mt-4">
          <Row label={copy.proposalPriceOnly} value={fmt(fallbackPriceCents ?? 0)} strong />
        </dl>
      )}

      {estimate && <p className="mt-3 text-sm leading-6 text-[#4b3a2c]">{copy.proposalEstimate(estimate)}</p>}
      {includes.length > 0 && (
        <p className="mt-3 text-sm leading-6 text-[#6b5847]">
          {copy.proposalIncludes}{colon(locale)} {includes.join(", ")}.
        </p>
      )}
      {acceptedOn && <p className="mt-3 text-sm text-[#6b5847]">{copy.proposalAcceptedOn(acceptedOn)}</p>}
      {paid ? (
        <p className="mt-4 text-sm font-medium text-[#2f4a2b]">{copy.proposalPaid}</p>
      ) : canAccept ? (
        <p className="mt-4 text-sm text-[#6b5847]">{copy.proposalPayAfterAccept}</p>
      ) : (
        !paymentEligible && <p className="mt-4 text-sm text-[#6b5847]">{copy.proposalNotPayable}</p>
      )}
      {acceptSlot && <div className="mt-4">{acceptSlot}</div>}
    </section>
  );
}

function BriefLines({ lines }: { lines: { label: string; value: string; tentative: boolean }[] }) {
  return (
    <dl className="divide-y divide-[#3b2a1d]/10">
      {lines.map((line, index) => (
        <div key={`${line.label}-${index}`} className="grid gap-1 py-3 sm:grid-cols-3 sm:gap-4">
          <dt className="text-sm text-[#6b5847]">{line.label}</dt>
          <dd className="break-words text-[#241a12] sm:col-span-2">{line.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-serif text-2xl text-[#241a12]">{children}</h2>;
}

export function CustomerCasePage({
  caseId,
  brand,
}: {
  caseId: string;
  brand: MarketplaceBrand | null;
}) {
  const locale = customerLocaleForBrand(brand);
  const en = locale === "en-US";
  const copy = customerCopy(locale);
  const fetchCase = useServerFn(getMyCustomerCase);
  // Avant tout retour anticipé : un hook ne s'appelle jamais conditionnellement.
  const { data, isPending, error, refetch, isFetching } = useQuery({
    queryKey: ["marketplace", "customer", "case", caseId] as const,
    queryFn: () => fetchCase({ data: { caseId } }),
  });
  const logisticsActionPending = useLogisticsCustomerAction(caseId,data?.case.commercialOrigin === "oppe");

  const back = (
    <nav aria-label={copy.backNavLabel}>
      <Link
        to="/mes-livres"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-medium text-[#3b2a1d] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b2a1d]/60 focus-visible:ring-offset-2"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {copy.backToBooks}
      </Link>
    </nav>
  );

  if (isPending)
    return (
      <div className="space-y-4">
        {back}
        <PortalDetailSkeleton label={copy.loading} />
      </div>
    );
  if (error)
    return (
      <div className="space-y-4">
        {back}
        <PortalError
          message={copy.loadError}
          retryLabel={copy.retry}
          onRetry={() => void refetch()}
          busy={isFetching}
        />
      </div>
    );
  if (!data) return null;
  if (data.case.commercialOrigin === "workshop_client") return <WorkshopCustomerCasePage caseId={caseId} view={data.view} language={data.case.preferredLanguage ?? (brand==="FINE_BINDERY"?"en":"fr")} assigned={data.case.workshopAssigned} />;

  const { view, proposal, selectedBinder } = data;
  const shippingJourney = data.shippingJourney ?? [];
  const facts: CustomerCaseFacts = {
    status: data.case.status,
    hasPrice: data.case.customerPriceCents !== null,
    proposalAccepted: proposal?.confirmedAt != null,
    proposalAcceptable: data.case.canAcceptProposal,
    paymentEligible: data.case.paymentEligible,
    paid: data.case.paidAt !== null,
    actionRequired: data.case.openDecisions > 0,
  };
  const status = customerStatus(facts, locale);
  const next = customerNextStep(facts, locale);
  const created = formatCustomerDate(data.case.createdAt, locale);
  const meta = [data.case.projectType, created ? copy.createdOn(created) : null].filter(Boolean).join(" · ");

  const project = presentBriefLines(view.project, locale);
  const timing = presentBriefLines(view.budgetAndTiming, locale);
  const missing = presentBriefLines(view.missingInformation, locale);
  const constraints = presentBriefLines(view.constraints, locale);
  const toConfirm = [...new Set([...project.toConfirm, ...timing.toConfirm, ...missing.shown.map((l) => l.label), ...missing.toConfirm])];
  const hasDetails =
    constraints.shown.length > 0 ||
    toConfirm.length > 0 ||
    Boolean(view.area) ||
    view.contact !== null ||
    view.reference !== "";

  const timeline = customerTimeline(
    {
      status: data.case.status,
      createdAt: data.case.createdAt,
      proposalPreparedAt: proposal?.preparedAt ?? null,
      proposalConfirmedAt: proposal?.confirmedAt ?? null,
      paidAt: data.case.paidAt,
      workshopSelectedAt: selectedBinder?.selectedAt ?? null,
    },
    locale,
  );

  const conciergeChannel = data.case.messagingChannel === "concierge";
  const decisionsOpen = data.case.openDecisions > 0;
  const decisions = <DecisionsPanel caseId={caseId} role="customer" locale={locale} hideWhenEmpty />;

  return (
    <div className="space-y-8">
      {back}

      <header className="flex items-start gap-4">
        <CoverPhoto photo={view.photos[0]} alt="" />
        <div className="min-w-0">
          <h1 className="font-serif text-3xl leading-tight text-[#241a12] break-words">{view.title}</h1>
          {meta && <p className="mt-1 text-sm text-[#6b5847]">{meta}</p>}
          <div className="mt-3">
            <StatusBadge status={status} />
          </div>
          {data.case.orderStatus && (
            <p className="mt-2 text-sm text-[#4b3a2c]">
              {locale.startsWith("en") ? "Order: " : "Commande : "}
              {ORDER_STAGE_LABELS[data.case.orderStatus][locale.startsWith("en") ? "en" : "fr"]}
            </p>
          )}
        </div>
      </header>

      <NextStepCard
        next={next}
        copy={copy}
        locale={locale}
        caseId={caseId}
        proposal={proposal}
        canPay={data.case.paymentEligible}
        conciergeChannel={conciergeChannel}
        showMessageLink={status.key !== "cancelled"}
        logisticsActionPending={logisticsActionPending}
      />

      {status.key !== "cancelled" && <LogisticsActionBanner caseId={caseId} locale={locale} />}

      {/* Une confirmation attendue est une action : elle passe avant le reste. */}
      {decisionsOpen && decisions}

      <ProposalCard
        proposal={proposal}
        fallbackPriceCents={data.case.customerPriceCents}
        includes={data.case.priceIncludes}
        paid={data.case.paidAt !== null}
        paymentEligible={data.case.paymentEligible}
        canAccept={data.case.canAcceptProposal}
        acceptSlot={
          data.case.canAcceptProposal && proposal && next.action !== "accept" ? (
            <AcceptButton caseId={caseId} proposalId={proposal.id} copy={copy} onAccepted={() => undefined} />
          ) : null
        }
        copy={copy}
        locale={locale}
      />

      {data.case.paidAt && <CustomerOppeDocuments caseId={caseId} english={locale.startsWith("en")} />}

      {status.key !== "cancelled" && <CustomerLogisticsPanel caseId={caseId} locale={locale} />}

      <section className={CARD}>
        <SectionTitle>{copy.summary}</SectionTitle>
        {view.summary && <p className="mt-3 leading-7 text-[#4b3a2c]">{view.summary}</p>}
        {(view.heritage || view.manualReviewRequired) && (
          <p className="mt-4 rounded-lg border border-[#8a5a2b]/30 bg-[#f3e6d3] px-4 py-3 text-sm leading-6 text-[#5b3a17]">
            {view.heritage ? copy.heritageNote : copy.manualReviewNote}
          </p>
        )}
        {project.shown.length > 0 && (
          <div className="mt-6">
            <h3 className="font-serif text-lg text-[#241a12]">{copy.theProject}</h3>
            <BriefLines lines={project.shown} />
          </div>
        )}
        {timing.shown.length > 0 && (
          <div className="mt-6">
            <h3 className="font-serif text-lg text-[#241a12]">{copy.budgetAndTiming}</h3>
            <BriefLines lines={timing.shown} />
          </div>
        )}
      </section>

      {view.photos.length > 0 && (
        <section aria-labelledby="photos-title">
          <h2 id="photos-title" className="font-serif text-2xl text-[#241a12]">
            {copy.photos}
          </h2>
          <div className="mt-4">
            <CustomerPhotoGallery photos={view.photos} copy={copy} />
          </div>
        </section>
      )}

      {selectedBinder && (
        <section>
          <SectionTitle>{copy.workshop}</SectionTitle>
          <div className={`mt-4 ${CARD}`}>
            <p className="font-serif text-xl text-[#241a12]">
              {selectedBinder.workshop_name ?? selectedBinder.display_name}
            </p>
            <p className="mt-1 text-sm text-[#6b5847]">
              {[
                selectedBinder.city,
                selectedBinder.years_experience ? copy.workshopYears(selectedBinder.years_experience) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {selectedBinder.skills.length > 0 && (
              <p className="mt-3 text-sm text-[#6b5847]">
                {selectedBinder.skills.map(en ? binderSkillLabelEn : binderSkillLabel).join(", ")}
              </p>
            )}
            {selectedBinder.bio && (
              <p className="mt-4 text-sm leading-6 text-[#4b3a2c]">{selectedBinder.bio}</p>
            )}
          </div>
        </section>
      )}

      {shippingJourney.length > 0 && (
        <section aria-labelledby="shipping-history-title" className={CARD}>
          <h2 id="shipping-history-title" className="font-serif text-2xl text-[#241a12]">
            {en ? "Book delivery" : "Acheminement du livre"}
          </h2>
          <ol className="mt-4 space-y-3">
            {shippingJourney.map((step, index) => (
              <li key={`${step.kind}-${step.at}-${index}`} className="border-l-2 border-[#a98c55] pl-4 text-sm text-[#4b3a2c]">
                <p className="font-medium text-[#241a12]">{{
                  outbound: en ? "On its way to the workshop" : "En route vers l’atelier",
                  carrier_delivered: en ? "Delivered according to the carrier" : "Livré selon le transporteur",
                  received: en ? "Physically received by the workshop" : "Réception physique confirmée par l’atelier",
                  incident: en ? "Transport incident reported" : "Incident signalé",
                  return: en ? "On its way back" : "En route vers vous",
                  completed: en ? "Final delivery declared by the workshop" : "Livraison finale déclarée par l’atelier",
                }[step.kind]}</p>
                {step.carrier && step.tracking && <p>{step.carrier} · {step.tracking}</p>}
                <p>{formatCustomerDate(step.at, locale)}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <ConversationPanel
        caseId={caseId}
        viewerRole="customer"
        locale={locale}
        channel={data.case.messagingChannel}
      />

      {!decisionsOpen && decisions}

      {timeline.length > 0 && (
        <section aria-labelledby="history-title">
          <h2 id="history-title" className="font-serif text-2xl text-[#241a12]">
            {copy.history}
          </h2>
          <ol className="mt-5 space-y-4">
            {timeline.map((entry) => {
              const date = formatCustomerDate(entry.at, locale);
              return (
                <li key={entry.key} className="flex gap-4">
                  <span aria-hidden="true" className="mt-2 h-px w-8 shrink-0 bg-[#a98c55]" />
                  <div>
                    <p className="font-serif text-lg text-[#241a12]">{entry.label}</p>
                    {date && <p className="text-sm text-[#6b5847]">{date}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {hasDetails && (
        <details className="group rounded-2xl border border-[#3b2a1d]/15 bg-[#fdfaf3] p-5">
          <summary className="-my-2 flex min-h-11 cursor-pointer items-center text-sm font-medium text-[#3b2a1d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b2a1d]/60">
            <span className="group-open:hidden">{copy.moreDetails}</span>
            <span className="hidden group-open:inline">{copy.lessDetails}</span>
          </summary>
          <div className="mt-4 space-y-6">
            {toConfirm.length > 0 && (
              <div>
                <h3 className="font-serif text-lg text-[#241a12]">{copy.toConfirmTitle}</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#4b3a2c]">
                  {toConfirm.map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
              </div>
            )}
            {constraints.shown.length > 0 && <BriefLines lines={constraints.shown} />}
            {view.area && (
              <div>
                <h3 className="font-serif text-lg text-[#241a12]">{copy.location}</h3>
                <p className="mt-1 text-[#241a12]">{view.area}</p>
              </div>
            )}
            {view.contact && (
              <div>
                <h3 className="font-serif text-lg text-[#241a12]">{copy.contact}</h3>
                <ul className="mt-1 space-y-1 text-[#241a12]">
                  {view.contact.name && <li>{view.contact.name}</li>}
                  {view.contact.email && <li>{view.contact.email}</li>}
                  {view.contact.phone && <li>{view.contact.phone}</li>}
                </ul>
              </div>
            )}
            {view.reference && (
              <p className="text-xs text-[#6b5847]">
                {copy.reference}{colon(locale)} {view.reference}
              </p>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
