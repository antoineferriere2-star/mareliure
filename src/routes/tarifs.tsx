import { createFileRoute } from "@tanstack/react-router";
import { TarifsPage } from "@/marketplace/pages/TarifsPage";
import { MARELIURE_CANONICAL_HOME } from "@/marketplace/config";
import { EDITORIAL_FONT_PRELOAD } from "@/marketplace/pages/landing/content";

/**
 * `/tarifs` — la page prix de Ma Reliure.
 *
 * Elle répond à la recherche la plus fréquente du domaine sans afficher un
 * seul montant : nous n'avons pas encore de fourchette relevée auprès d'assez
 * d'ateliers pour en publier une honnêtement, et une grille inventée serait
 * pire que pas de grille.
 *
 * Le jour où le référentiel couvrira un travail avec au moins trois ateliers
 * de référence (`isPublishableRange`), la fourchette pourra apparaître ici —
 * relevée, jamais estimée.
 *
 * Aucune donnée structurée de prix (`Offer`, `AggregateOffer`) n'est déclarée,
 * pour la même raison : annoncer un prix à un moteur de recherche est un
 * engagement, pas une optimisation.
 */
const TITLE = "Prix d’une reliure ou d’une restauration de livre — Ma Reliure";
const DESCRIPTION =
  "Ce qui détermine le prix d’une reliure ou d’une restauration : l’état du livre, sa structure, son format, les matières, la dorure et les finitions.";

export const Route = createFileRoute("/tarifs")({
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
  component: TarifsPage,
});
