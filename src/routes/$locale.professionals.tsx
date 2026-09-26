import { createFileRoute, notFound } from "@tanstack/react-router";
import { FineBinderyDirectoryPage } from "@/marketplace/pages/fineBindery/PublicWorkshopPages";
import { listPublicFineBinderyProfiles } from "@/marketplace/services/fineBinderyProfile.data.functions";
import { isFineBinderyLocale } from "@/marketplace/i18n/fineBinderyLocale";
import { fineBinderyDirectoryHead } from "@/marketplace/i18n/fineBinderySeo";

export const Route = createFileRoute("/$locale/professionals")({
  beforeLoad: ({ params }) => { if (!isFineBinderyLocale(params.locale)) throw notFound(); },
  loader: () => listPublicFineBinderyProfiles(),
  head: ({ params, loaderData }) => isFineBinderyLocale(params.locale) ? fineBinderyDirectoryHead(params.locale, Boolean(loaderData?.length)) : {},
  component: LocalizedDirectory,
});

function LocalizedDirectory() {
  const { locale } = Route.useParams();
  const profiles = Route.useLoaderData();
  return isFineBinderyLocale(locale) ? <FineBinderyDirectoryPage profiles={profiles} locale={locale} /> : null;
}
