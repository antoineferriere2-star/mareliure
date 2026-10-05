/** Présentation publique de l’outil et de la page vitrine pour les ateliers de reliure. */
import { createFileRoute } from "@tanstack/react-router";
import { PartnersLandingPage } from "@/marketplace/pages/partners/PartnersLanding";
import { MARELIURE_CANONICAL_HOME } from "@/marketplace/config";
import { EDITORIAL_FONT_PRELOAD } from "@/marketplace/pages/landing/content";
import { breadcrumbSchema, faqPageSchema, jsonLdScript, MARELIURE_SITE_URL } from "@/lib/structured-data";
import { PARTNER_FAQ } from "@/marketplace/pages/landing/partnersContent";

const TITLE = "Ma Reliure pour les relieurs — Devis, ouvrages et facturation";
const DESCRIPTION =
  "Devis, ouvrages, clients, factures et page vitrine pour les relieurs et restaurateurs : 15 € HT par mois pour les nouveaux ateliers. Paiement en ligne facultatif.";

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
          "Accueil",
        ),
      ),
      // Les questions affichées par la page, depuis le même tableau.
      jsonLdScript(faqPageSchema(PARTNER_FAQ)),
    ],
  }),
  component: PartnersLandingPage,
});
