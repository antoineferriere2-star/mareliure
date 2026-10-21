import {workshopIntakeGuidance} from "@/marketplace/pages/customer/workshopIntakeGuidance";
import { useMemo, type ReactNode } from "react";
import { createFileRoute, notFound, useParams } from "@tanstack/react-router";
import { MissionRuntime } from "@/build/pages/public/MissionRuntime";
import { MissionRuntimePending } from "@/build/pages/public/MissionRuntimeStates";
import { FR_PUBLIC_COPY } from "@/build/pages/public/frPublicCopy";
import { DE_FINE_BINDERY_COPY, IT_FINE_BINDERY_COPY } from "@/build/pages/public/fineBinderyEuropeanCopy";
import { ES_PUBLIC_COPY } from "@/build/pages/public/publicLocaleContext";
import { FINE_BINDERY_PUBLIC_TOKEN } from "@/build/constants";
import { CustomerSpaceOffer } from "@/marketplace/pages/customer/CustomerSpaceOffer";
import { WorkshopIntakeNotice } from "@/marketplace/pages/customer/WorkshopIntakeCopy";
import { FINE_BINDERY_PREFERRED_LANGUAGE_KEY, FINE_BINDERY_SUBMISSION_LOCALE_KEY, PROFILE_REQUEST_SOURCE, PROFILE_SOURCE_ANSWER_KEY } from "@/marketplace/binders/fineBinderyProfile";
import { REFERRAL_ANSWER_KEY } from "@/marketplace/binders/referral";
import { ENGINE_LOCALE, isFineBinderyLocale } from "@/marketplace/i18n/fineBinderyLocale";
import { fineBinderyHeadCopy } from "@/marketplace/i18n/fineBinderyHeadCopy";
import { fineBinderyLocalizedHead } from "@/marketplace/i18n/fineBinderySeo";

export const Route = createFileRoute("/$locale/project")({
  ssr: false,
  beforeLoad: ({ params }) => { if (!isFineBinderyLocale(params.locale)) throw notFound(); },
  validateSearch: (search: Record<string, unknown>): { ref?: string; source?: typeof PROFILE_REQUEST_SOURCE } => ({ ...(typeof search.ref === "string" && search.ref.length <= 64 ? { ref: search.ref } : {}), ...(search.source === PROFILE_REQUEST_SOURCE ? { source: PROFILE_REQUEST_SOURCE } : {}) }),
  // Parcours de saisie, jamais indexé ; titre et description dans la langue de la page (audit SEO du 12 octobre 2026).
  head: ({ params }) => isFineBinderyLocale(params.locale)
    ? fineBinderyLocalizedHead(params.locale, { title: `${fineBinderyHeadCopy(params.locale).start} — Fine Bindery`, description: fineBinderyHeadCopy(params.locale).seo.homeDescription, pathWithoutLocale: "project", noindex: true })
    : { meta: [{ title: "Project — Fine Bindery" }, { name: "robots", content: "noindex, nofollow" }] },
  pendingComponent: FineBinderyProjectPending,
  component: FineBinderyProjectRoute,
});

const PREPARING = "Preparing your project intake…";
const PREPARING_BY_LOCALE: Record<string, string | undefined> = {
  fr: FR_PUBLIC_COPY[PREPARING], de: DE_FINE_BINDERY_COPY[PREPARING], it: IT_FINE_BINDERY_COPY[PREPARING], es: ES_PUBLIC_COPY[PREPARING],
};

/** Rendu par le serveur avant le JavaScript (route sans SSR), dans la langue de l'adresse. */
function FineBinderyProjectPending() {
  const { locale } = useParams({ strict: false }) as { locale?: string };
  return <div className="fb-intake"><MissionRuntimePending label={(locale && PREPARING_BY_LOCALE[locale]) || PREPARING} /></div>;
}

function FineBinderyProjectRoute() {
  const { locale } = Route.useParams(); const { ref, source } = Route.useSearch();
  const seedAnswers = useMemo(() => isFineBinderyLocale(locale) ? { [FINE_BINDERY_SUBMISSION_LOCALE_KEY]: locale, [FINE_BINDERY_PREFERRED_LANGUAGE_KEY]: locale, ...(ref ? { [REFERRAL_ANSWER_KEY]: ref } : {}), ...(source === PROFILE_REQUEST_SOURCE ? { [PROFILE_SOURCE_ANSWER_KEY]: source } : {}) } : undefined, [locale, ref, source]);
  if (!isFineBinderyLocale(locale)) return null;
  const afterSubmission = ({ visitorEmail }: { visitorEmail: string | null }): ReactNode => <>{ref && <WorkshopIntakeNotice locale={locale} stage="next" />}<CustomerSpaceOffer email={visitorEmail} publicToken={FINE_BINDERY_PUBLIC_TOKEN} /></>;
  // `fb-intake` : la palette Fine Bindery (styles.css) sur le même runtime de Mission — aucune règle de marque dans le moteur.
  return <div className="fb-intake"><MissionRuntime publicToken={FINE_BINDERY_PUBLIC_TOKEN} renderAfterSubmission={afterSubmission} seedAnswers={seedAnswers} guidance={ref ? workshopIntakeGuidance(locale) : undefined} initialLocale={ENGINE_LOCALE[locale]} routeLocaleWins /></div>;
}
