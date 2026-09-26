import { loadFineBinderyHomeAvailability } from "@/marketplace/pages/fineBindery/homeAvailability";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { FineBinderyLandingPage } from "@/marketplace/pages/fineBindery/FineBinderyLanding";
import { isFineBinderyLocale } from "@/marketplace/i18n/fineBinderyLocale";
import { fineBinderyHomeHead } from "@/marketplace/i18n/fineBinderySeo";

export const Route = createFileRoute("/$locale/")({
  beforeLoad: ({ params }) => { if (!isFineBinderyLocale(params.locale)) throw notFound(); },
  loader: () => loadFineBinderyHomeAvailability(),
  head: ({ params }) => isFineBinderyLocale(params.locale) ? fineBinderyHomeHead(params.locale) : {},
  component: LocalizedFineBinderyHome,
});

function LocalizedFineBinderyHome() {
  const { locale } = Route.useParams();
  const hasPublishedProfiles = Route.useLoaderData();
  return isFineBinderyLocale(locale) ? <FineBinderyLandingPage locale={locale} hasPublishedProfiles={hasPublishedProfiles} /> : null;
}
