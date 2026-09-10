import { createFileRoute } from "@tanstack/react-router";
import { ConditionsPage } from "@/marketplace/pages/legal/LegalPages";
import { MARELIURE_CANONICAL_HOME } from "@/marketplace/config";
import { EDITORIAL_FONT_PRELOAD } from "@/marketplace/pages/landing/content";

const TITLE = "Conditions d'utilisation — Ma Reliure";
const DESCRIPTION =
  "Les conditions d'accès au site Ma Reliure et d'utilisation de son service de présentation de projet.";

export const Route = createFileRoute("/conditions")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: `${MARELIURE_CANONICAL_HOME}conditions` },
    ],
    links: [
      { rel: "canonical", href: `${MARELIURE_CANONICAL_HOME}conditions` },
      EDITORIAL_FONT_PRELOAD,
    ],
  }),
  component: ConditionsPage,
});
