import { createFileRoute } from "@tanstack/react-router";
import { ConfidentialitePage } from "@/marketplace/pages/legal/LegalPages";
import { MARELIURE_CANONICAL_HOME } from "@/marketplace/config";
import { EDITORIAL_FONT_PRELOAD } from "@/marketplace/pages/landing/content";

const TITLE = "Politique de confidentialité — Ma Reliure";
const DESCRIPTION =
  "Les informations que Ma Reliure collecte lorsque vous présentez votre livre, pourquoi, qui y a accès, et vos droits.";

export const Route = createFileRoute("/confidentialite")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: `${MARELIURE_CANONICAL_HOME}confidentialite` },
    ],
    links: [
      { rel: "canonical", href: `${MARELIURE_CANONICAL_HOME}confidentialite` },
      EDITORIAL_FONT_PRELOAD,
    ],
  }),
  component: ConfidentialitePage,
});
