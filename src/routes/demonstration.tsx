import { createFileRoute } from "@tanstack/react-router";
import { DemonstrationPage } from "@/marketplace/pages/DemonstrationPage";
import { MARELIURE_CANONICAL_HOME } from "@/marketplace/config";
import { EDITORIAL_FONT_PRELOAD } from "@/marketplace/pages/landing/content";
import { breadcrumbSchema, jsonLdScript, MARELIURE_SITE_URL } from "@/lib/structured-data";

/**
 * `/demonstration` : ce que voit le client d'un atelier derrière le lien partagé, la fiche reçue
 * par l'atelier et le devis qui en sort. Exemple fictif, sans montant (demonstrationContent.ts).
 */
const TITLE = "Démonstration — Ma Reliure";
const DESCRIPTION =
  "Voyez le parcours de votre client derrière votre lien Ma Reliure, la fiche structurée que vous recevez, puis le devis qui en sort. Exemple fictif.";

export const Route = createFileRoute("/demonstration")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "index, follow" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Ma Reliure" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: `${MARELIURE_CANONICAL_HOME}demonstration` },
      { property: "og:locale", content: "fr_FR" },
    ],
    links: [{ rel: "canonical", href: `${MARELIURE_CANONICAL_HOME}demonstration` }, EDITORIAL_FONT_PRELOAD],
    scripts: [jsonLdScript(breadcrumbSchema([{ name: "Démonstration", path: "/demonstration" }], MARELIURE_SITE_URL, "Accueil"))],
  }),
  component: DemonstrationPage,
});
