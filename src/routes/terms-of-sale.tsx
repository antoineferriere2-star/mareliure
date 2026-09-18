/** Fine Bindery's own Terms of Sale — the English equivalent of /conditions-generales-de-vente. */
import { createFileRoute } from "@tanstack/react-router";
import { TermsOfSalePage } from "@/marketplace/pages/legal/LegalPages";
import { MARKETPLACE_BRAND_CONFIGS } from "@/marketplace/brand/brandConfig";
import { EDITORIAL_FONT_PRELOAD } from "@/marketplace/pages/landing/content";

const CANONICAL = `${MARKETPLACE_BRAND_CONFIGS.FINE_BINDERY.seo.canonicalOrigin}/terms-of-sale`;
const TITLE = "Terms of Sale — Fine Bindery";
const DESCRIPTION =
  "What governs your order with Fine Bindery, from the moment a price is confirmed for your project.";

export const Route = createFileRoute("/terms-of-sale")({
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
  component: TermsOfSalePage,
});
