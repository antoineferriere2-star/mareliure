/** Fine Bindery's legal notice — the English equivalent of /mentions-legales. */
import { createFileRoute } from "@tanstack/react-router";
import { LegalNoticePage } from "@/marketplace/pages/legal/LegalPages";
import { MARKETPLACE_BRAND_CONFIGS } from "@/marketplace/brand/brandConfig";
import { EDITORIAL_FONT_PRELOAD } from "@/marketplace/pages/landing/content";

const CANONICAL = `${MARKETPLACE_BRAND_CONFIGS.FINE_BINDERY.seo.canonicalOrigin}/legal-notice`;
const TITLE = "Legal Notice — Fine Bindery";
const DESCRIPTION = "Who publishes Fine Bindery, and where the site is hosted.";

export const Route = createFileRoute("/legal-notice")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: CANONICAL },
    ],
    links: [{ rel: "canonical", href: CANONICAL }, EDITORIAL_FONT_PRELOAD],
  }),
  component: LegalNoticePage,
});
