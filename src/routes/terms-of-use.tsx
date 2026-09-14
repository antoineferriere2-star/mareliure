/**
 * Fine Bindery's Terms of Use. Deliberately not "/terms" — Métré Build
 * already owns that path on this shared codebase (src/routes/terms.tsx),
 * with unrelated content; reusing it would collide two live products under
 * one URL.
 */
import { createFileRoute } from "@tanstack/react-router";
import { TermsPage } from "@/marketplace/pages/legal/LegalPages";
import { MARKETPLACE_BRAND_CONFIGS } from "@/marketplace/brand/brandConfig";
import { EDITORIAL_FONT_PRELOAD } from "@/marketplace/pages/landing/content";

const CANONICAL = `${MARKETPLACE_BRAND_CONFIGS.FINE_BINDERY.seo.canonicalOrigin}/terms-of-use`;
const TITLE = "Terms of Use — Fine Bindery";
const DESCRIPTION = "What you can expect from the Fine Bindery site, and what it does not yet commit to.";

export const Route = createFileRoute("/terms-of-use")({
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
  component: TermsPage,
});
