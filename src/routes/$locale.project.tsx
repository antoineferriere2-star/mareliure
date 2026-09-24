import { useMemo, type ReactNode } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { MissionRuntime } from "@/build/pages/public/MissionRuntime";
import { FINE_BINDERY_PUBLIC_TOKEN } from "@/build/constants";
import { CustomerSpaceOffer } from "@/marketplace/pages/customer/CustomerSpaceOffer";
import { FINE_BINDERY_PREFERRED_LANGUAGE_KEY, FINE_BINDERY_SUBMISSION_LOCALE_KEY, PROFILE_REQUEST_SOURCE, PROFILE_SOURCE_ANSWER_KEY } from "@/marketplace/binders/fineBinderyProfile";
import { REFERRAL_ANSWER_KEY } from "@/marketplace/binders/referral";
import { ENGINE_LOCALE, isFineBinderyLocale } from "@/marketplace/i18n/fineBinderyLocale";
import { fineBinderyCopy } from "@/marketplace/i18n/fineBinderyCopy";

export const Route = createFileRoute("/$locale/project")({
  ssr: false,
  beforeLoad: ({ params }) => { if (!isFineBinderyLocale(params.locale)) throw notFound(); },
  validateSearch: (search: Record<string, unknown>): { ref?: string; source?: typeof PROFILE_REQUEST_SOURCE } => ({ ...(typeof search.ref === "string" && search.ref.length <= 64 ? { ref: search.ref } : {}), ...(search.source === PROFILE_REQUEST_SOURCE ? { source: PROFILE_REQUEST_SOURCE } : {}) }),
  head: ({ params }) => ({ meta: [{ title: `${isFineBinderyLocale(params.locale) ? fineBinderyCopy(params.locale).common.start : "Project"} — Fine Bindery` }, { name: "robots", content: "noindex, nofollow" }] }),
  component: FineBinderyProjectRoute,
});

function FineBinderyProjectRoute() {
  const { locale } = Route.useParams(); const { ref, source } = Route.useSearch();
  const seedAnswers = useMemo(() => isFineBinderyLocale(locale) ? { [FINE_BINDERY_SUBMISSION_LOCALE_KEY]: locale, [FINE_BINDERY_PREFERRED_LANGUAGE_KEY]: locale, ...(ref ? { [REFERRAL_ANSWER_KEY]: ref } : {}), ...(source === PROFILE_REQUEST_SOURCE ? { [PROFILE_SOURCE_ANSWER_KEY]: source } : {}) } : undefined, [locale, ref, source]);
  if (!isFineBinderyLocale(locale)) return null;
  const afterSubmission = ({ visitorEmail }: { visitorEmail: string | null }): ReactNode => <CustomerSpaceOffer email={visitorEmail} publicToken={FINE_BINDERY_PUBLIC_TOKEN} />;
  return <MissionRuntime publicToken={FINE_BINDERY_PUBLIC_TOKEN} renderAfterSubmission={afterSubmission} seedAnswers={seedAnswers} initialLocale={ENGINE_LOCALE[locale]} />;
}
