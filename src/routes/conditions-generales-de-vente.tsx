import { createFileRoute } from "@tanstack/react-router";
import { ConditionsVentePage } from "@/marketplace/pages/legal/LegalPages";
import { MARELIURE_CANONICAL_HOME } from "@/marketplace/config";
import { EDITORIAL_FONT_PRELOAD } from "@/marketplace/pages/landing/content";

const TITLE = "Conditions générales de vente — Ma Reliure";
const DESCRIPTION =
  "Ce qui régit votre commande auprès de Ma Reliure, à partir du moment où un prix est confirmé pour votre projet.";

export const Route = createFileRoute("/conditions-generales-de-vente")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      {
        property: "og:url",
        content: `${MARELIURE_CANONICAL_HOME}conditions-generales-de-vente`,
      },
    ],
    links: [
      { rel: "canonical", href: `${MARELIURE_CANONICAL_HOME}conditions-generales-de-vente` },
      EDITORIAL_FONT_PRELOAD,
    ],
  }),
  component: ConditionsVentePage,
});
