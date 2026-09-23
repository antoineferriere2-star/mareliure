import { createFileRoute } from "@tanstack/react-router";
import { FineBinderyWorkshopNotFound, FineBinderyWorkshopPage } from "@/marketplace/pages/fineBindery/PublicWorkshopPages";
import { getPublicFineBinderyProfile } from "@/marketplace/services/fineBinderyProfile.data.functions";

export const Route = createFileRoute("/fr/$slug")({
  loader: ({ params }) => getPublicFineBinderyProfile({ data: { slug: params.slug } }),
  head: ({ loaderData, params }) => {
    if (!loaderData) return { meta: [{ title: "Atelier introuvable — FineBindery" }, { name: "robots", content: "noindex, nofollow" }] };
    const title = `${loaderData.workshopName} — Reliure et restauration | FineBindery`;
    const description = loaderData.bio.slice(0, 158);
    const canonical = `https://finebindery.com/fr/${params.slug}`;
    const image = loaderData.workshopPhotoUrl ?? loaderData.logoUrl;
    return {
      meta: [
        { title }, { name: "description", content: description }, { name: "robots", content: "index, follow" },
        { property: "og:title", content: title }, { property: "og:description", content: description },
        { property: "og:type", content: "profile" }, { property: "og:url", content: canonical },
        { property: "og:site_name", content: "FineBindery" }, { property: "og:locale", content: "fr_FR" },
        ...(image ? [{ property: "og:image", content: image }] : []),
      ],
      links: [{ rel: "canonical", href: canonical }],
      scripts: [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org", "@type": "ProfessionalService", name: loaderData.workshopName,
          url: canonical, description, founder: loaderData.professionalName,
          email: loaderData.professionalEmail ?? undefined, telephone: loaderData.professionalPhone ?? undefined,
          address: { "@type": "PostalAddress", addressLocality: loaderData.city, postalCode: loaderData.postalCode ?? undefined, addressCountry: loaderData.countryCode },
          knowsLanguage: loaderData.languages, sameAs: [loaderData.websiteUrl, loaderData.instagramUrl].filter(Boolean),
        }),
      }],
    };
  },
  component: WorkshopRoute,
});

function WorkshopRoute() {
  const profile = Route.useLoaderData();
  return profile ? <FineBinderyWorkshopPage profile={profile} /> : <FineBinderyWorkshopNotFound />;
}
