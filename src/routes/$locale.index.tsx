import { createFileRoute, notFound } from "@tanstack/react-router";
import { FineBinderyLandingPage } from "@/marketplace/pages/fineBindery/FineBinderyLanding";
import { isFineBinderyLocale } from "@/marketplace/i18n/fineBinderyLocale";
import { fineBinderyHomeHead } from "@/marketplace/i18n/fineBinderySeo";

export const Route = createFileRoute("/$locale/")({
  beforeLoad: ({ params }) => { if (!isFineBinderyLocale(params.locale)) throw notFound(); },
  head: ({ params }) => isFineBinderyLocale(params.locale) ? fineBinderyHomeHead(params.locale) : {},
  component: LocalizedFineBinderyHome,
});

function LocalizedFineBinderyHome() {
  const { locale } = Route.useParams();
  return isFineBinderyLocale(locale) ? <FineBinderyLandingPage locale={locale} /> : null;
}
