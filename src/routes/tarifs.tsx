import { createFileRoute } from "@tanstack/react-router";
import { TarifsPage } from "@/marketplace/pages/TarifsPage";
import { MARELIURE_CANONICAL_HOME } from "@/marketplace/config";
import { EDITORIAL_FONT_PRELOAD } from "@/marketplace/pages/landing/content";
import { getPublicPrices } from "@/marketplace/services/publicPricing.functions";

/**
 * `/tarifs` — la page prix de Ma Reliure.
 *
 * Elle répond à la recherche la plus fréquente du domaine en expliquant ce qui
 * fait le prix. Elle n'affiche un montant que si Ma Reliure l'a arrêté au
 * Pricebook **et** a choisi de l'annoncer : ni fourchette relevée sur le web,
 * ni tarif d'atelier ne peuvent y arriver (`publicPrices.ts`). Tant qu'aucun
 * prix n'est publié ainsi, la page n'en montre aucun.
 *
 * Aucune donnée structurée de prix (`Offer`, `AggregateOffer`) n'est déclarée :
 * annoncer un prix à un moteur de recherche est un engagement, pas une
 * optimisation.
 */
const TITLE = "Prix d’une reliure ou d’une restauration de livre — Ma Reliure";
const DESCRIPTION =
  "Ce qui détermine le prix d’une reliure ou d’une restauration : l’état du livre, sa structure, son format, les matières, la dorure et les finitions.";

export const Route = createFileRoute("/tarifs")({
  loader: () => getPublicPrices(),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "index, follow" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Ma Reliure" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: `${MARELIURE_CANONICAL_HOME}tarifs` },
      { property: "og:locale", content: "fr_FR" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [
      { rel: "canonical", href: `${MARELIURE_CANONICAL_HOME}tarifs` },
      EDITORIAL_FONT_PRELOAD,
    ],
  }),
  component: TarifsRoute,
});

function TarifsRoute() {
  const publicPrices = Route.useLoaderData();
  return <TarifsPage publicPrices={publicPrices} />;
}
