import { createFileRoute } from "@tanstack/react-router";
import { ReliureLanding } from "@/marketplace/pages/ReliureLanding";
import { MARELIURE_CANONICAL_ORIGIN } from "@/marketplace/config";

/**
 * Ma Reliure's public landing.
 *
 * The canonical URL is the bare origin, not this path: on mareliure.fr this
 * page is the site's front door. Until the deployment makes it the root route,
 * the canonical still points at the origin so search engines are never told
 * that /reliure and / are two different pages — see
 * docs/deployment-mareliure-ovh.md, "Route racine".
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
      { property: "og:url", content: MARELIURE_CANONICAL_ORIGIN },
      { property: "og:locale", content: "fr_FR" },
      // Twitter reads its own tags and falls back to OG for the rest.
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: MARELIURE_CANONICAL_ORIGIN }],
  }),
  component: ReliureLanding,
});
