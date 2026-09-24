import { createFileRoute, notFound } from "@tanstack/react-router";
import { FineBinderyWorkshopNotFound, FineBinderyWorkshopPage } from "@/marketplace/pages/fineBindery/PublicWorkshopPages";
import { getPublicFineBinderyProfile } from "@/marketplace/services/fineBinderyProfile.data.functions";
import { fineBinderyCopy } from "@/marketplace/i18n/fineBinderyCopy";
import { fineBinderyLocalizedHead } from "@/marketplace/i18n/fineBinderySeo";
import { isFineBinderyLocale } from "@/marketplace/i18n/fineBinderyLocale";

export const Route = createFileRoute("/$locale/$slug")({
  beforeLoad: ({ params }) => { if (!isFineBinderyLocale(params.locale) || ["professionals", "project"].includes(params.slug)) throw notFound(); },
  loader: ({ params }) => getPublicFineBinderyProfile({ data: { slug: params.slug } }),
  head: ({ loaderData, params }) => {
    if (!isFineBinderyLocale(params.locale)) return {};
    if (!loaderData) return { meta: [{ title: `${fineBinderyCopy(params.locale).profile.notFound} — Fine Bindery` }, { name: "robots", content: "noindex, nofollow" }] };
    const copy = fineBinderyCopy(params.locale);
    return { ...fineBinderyLocalizedHead(params.locale, { title: copy.seo.profileTitle(loaderData.workshopName), description: copy.seo.profileDescription(loaderData.workshopName, loaderData.city), pathWithoutLocale: params.slug, type: "profile", image: loaderData.workshopPhotoUrl ?? loaderData.logoUrl }), scripts: [{ type: "application/ld+json", children: JSON.stringify({ "@context": "https://schema.org", "@type": "ProfessionalService", name: loaderData.workshopName, url: `https://finebindery.com/${params.locale}/${params.slug}`, description: loaderData.bio, founder: loaderData.professionalName, address: { "@type": "PostalAddress", addressLocality: loaderData.city, postalCode: loaderData.postalCode ?? undefined, addressCountry: loaderData.countryCode }, knowsLanguage: loaderData.languages, sameAs: [loaderData.websiteUrl, loaderData.instagramUrl].filter(Boolean) }) }] };
  },
  component: LocalizedWorkshop,
});

function LocalizedWorkshop() {
  const { locale } = Route.useParams(); const profile = Route.useLoaderData();
  if (!isFineBinderyLocale(locale)) return null;
  return profile ? <FineBinderyWorkshopPage profile={profile} locale={locale} /> : <FineBinderyWorkshopNotFound locale={locale} />;
}
