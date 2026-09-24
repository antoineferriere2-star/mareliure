import { createFileRoute } from "@tanstack/react-router";
import { FineBinderyDirectoryPage } from "@/marketplace/pages/fineBindery/PublicWorkshopPages";
import { listPublicFineBinderyProfiles } from "@/marketplace/services/fineBinderyProfile.data.functions";

const TITLE = "Relieurs et restaurateurs en France — FineBindery";
const DESCRIPTION = "Découvrez les ateliers de reliure, restauration, conservation et dorure publiés sur le réseau professionnel FineBindery.";

export const Route = createFileRoute("/professionnels")({
  loader: () => listPublicFineBinderyProfiles(),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://finebindery.com/professionnels" },
    ],
    links: [{ rel: "canonical", href: "https://finebindery.com/professionnels" }],
  }),
  component: DirectoryRoute,
});

function DirectoryRoute() {
  return <FineBinderyDirectoryPage profiles={Route.useLoaderData()} locale="en" />;
}
