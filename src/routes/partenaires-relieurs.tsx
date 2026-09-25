/** Présentation publique de l’outil gratuit pour les ateliers de reliure. */
import { createFileRoute } from "@tanstack/react-router";
import { PartnersLandingPage } from "@/marketplace/pages/partners/PartnersLanding";
import { MARELIURE_CANONICAL_HOME } from "@/marketplace/config";
import { EDITORIAL_FONT_PRELOAD } from "@/marketplace/pages/landing/content";
import { breadcrumbSchema, jsonLdScript, MARELIURE_SITE_URL } from "@/lib/structured-data";

const TITLE = "Ma Reliure pour les relieurs — Devis, ouvrages et facturation";
const DESCRIPTION =
  "Créez vos devis, gérez vos ouvrages, clients et factures avec Ma Reliure. Outil gratuit pour les relieurs et restaurateurs. Paiement en ligne facultatif.";

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
    scripts: [
      jsonLdScript(
        breadcrumbSchema(
          [{ name: "Pour les relieurs", path: "/partenaires-relieurs" }],
          MARELIURE_SITE_URL,
        ),
      ),
    ],
  }),
  component: PartnersLandingPage,
});
