import { createFileRoute } from "@tanstack/react-router";
import { MentionsLegalesPage } from "@/marketplace/pages/legal/LegalPages";
import { MARELIURE_CANONICAL_HOME } from "@/marketplace/config";
import { EDITORIAL_FONT_PRELOAD } from "@/marketplace/pages/landing/content";

const TITLE = "Mentions légales — Ma Reliure";
const DESCRIPTION = "Éditeur, directeur de la publication et hébergement du site Ma Reliure.";

export const Route = createFileRoute("/mentions-legales")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: `${MARELIURE_CANONICAL_HOME}mentions-legales` },
    ],
    links: [
      { rel: "canonical", href: `${MARELIURE_CANONICAL_HOME}mentions-legales` },
      EDITORIAL_FONT_PRELOAD,
    ],
  }),
  component: MentionsLegalesPage,
});
