/**
 * Fine Bindery's Privacy Policy. Deliberately not "/privacy" — Métré Build
 * already owns that path on this shared codebase (src/routes/privacy.tsx),
 * with unrelated content; reusing it would collide two live products under
 * one URL.
 */
import { createFileRoute } from "@tanstack/react-router";
import { PrivacyPage } from "@/marketplace/pages/legal/LegalPages";
import { MARKETPLACE_BRAND_CONFIGS } from "@/marketplace/brand/brandConfig";
import { EDITORIAL_FONT_PRELOAD } from "@/marketplace/pages/landing/content";

const CANONICAL = `${MARKETPLACE_BRAND_CONFIGS.FINE_BINDERY.seo.canonicalOrigin}/privacy-policy`;
const TITLE = "Privacy Policy — Fine Bindery";
const DESCRIPTION =
  "What Fine Bindery does with the information you give us when presenting your book, and how to stay in control of it.";

export const Route = createFileRoute("/privacy-policy")({
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
  component: PrivacyPage,
});
