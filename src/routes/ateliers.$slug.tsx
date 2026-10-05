import { createFileRoute } from "@tanstack/react-router";
import { getPublicFineBinderyProfile } from "@/marketplace/services/fineBinderyProfile.data.functions";
import { FineBinderyWorkshopPage } from "@/marketplace/pages/fineBindery/PublicWorkshopPages";
export const Route = createFileRoute("/ateliers/$slug")({
  loader: ({ params }) => getPublicFineBinderyProfile({ data: { slug: params.slug } }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.workshopName} — Ma Reliure`
          : "Vitrine indisponible — Ma Reliure",
      },
      ...(!loaderData ? [{ name: "robots", content: "noindex, nofollow" }] : []),
    ],
  }),
  component: Workshop,
});
function Workshop() {
  const profile = Route.useLoaderData();
  return profile ? (
    <FineBinderyWorkshopPage profile={profile} locale="fr" brand="mareliure" />
  ) : (
    <main className="mx-auto max-w-xl px-5 py-16">
      <h1>Cette vitrine est indisponible.</h1>
      <a href="/">Ma Reliure</a>
    </main>
  );
}
