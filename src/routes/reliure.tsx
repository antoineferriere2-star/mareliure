import { createFileRoute } from "@tanstack/react-router";
import { ReliureLanding } from "@/marketplace/pages/ReliureLanding";
import { MARELIURE_CANONICAL_HOME } from "@/marketplace/config";

/**
 * Ma Reliure's public landing.
 *
 * On a Ma Reliure deployment the homepage at `/` renders this same landing
 * (see src/brand.ts), so this path is a second door onto one page. Its
 * canonical therefore points at `https://mareliure.fr/`, never at itself:
 * telling search engines these are two pages would split the domain's
 * authority between them.
 *
 * No figure in the description is invented (§59): no rating, no project count,
 * no artisan count, because none of them are real yet.
 */
const TITLE = "Ma Reliure — Reliure et restauration de livres";
const DESCRIPTION =
  "Confiez votre livre à l'artisan adapté à votre projet de reliure, restauration ou transformation.";

export const Route = createFileRoute("/reliure")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "index, follow" },
      // Open Graph
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Ma Reliure" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: MARELIURE_CANONICAL_HOME },
      { property: "og:locale", content: "fr_FR" },
      // Twitter reads its own tags and falls back to OG for the rest.
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: MARELIURE_CANONICAL_HOME }],
  }),
  component: ReliureLanding,
});
