/**
 * Page publique de recrutement pour les ateliers de reliure indépendants —
 * distincte de la landing client (ReliureLanding.tsx) : celle-ci vend
 * l'entrée dans le réseau, pas la présentation d'un livre.
 */
import { createFileRoute } from "@tanstack/react-router";
import { PartnersLandingPage } from "@/marketplace/pages/partners/PartnersLanding";
import { MARELIURE_CANONICAL_HOME } from "@/marketplace/config";
import { EDITORIAL_FONT_PRELOAD } from "@/marketplace/pages/landing/content";

const TITLE = "Ateliers partenaires — Rejoindre le réseau Ma Reliure";
const DESCRIPTION =
  "Rejoignez le réseau d'ateliers indépendants de Ma Reliure : projets qualifiés, rémunération connue avant d'accepter, et vos propres clients suivis dans le même espace.";

export const Route = createFileRoute("/partenaires-relieurs")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: `${MARELIURE_CANONICAL_HOME}partenaires-relieurs` },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "canonical", href: `${MARELIURE_CANONICAL_HOME}partenaires-relieurs` },
      EDITORIAL_FONT_PRELOAD,
    ],
  }),
  component: PartnersLandingPage,
});
