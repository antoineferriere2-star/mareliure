import { createFileRoute } from "@tanstack/react-router";
import { BuildDeckBuildersPage } from "@/build/pages/public/BuildMarketingPages";
import { breadcrumbSchema, faqPageSchema, jsonLdScript, SITE_URL } from "@/lib/structured-data";
import { DECK_BUILDERS_FAQ } from "@/build/content/publicFaq";

const title = "Lead Qualification Software for Deck Builders — Métré Build";
const description =
  "Stop quoting blind. Deck builders get scope, dimensions, height, access, material and budget before the first call — with every answer sourced. Try the demo.";

export const Route = createFileRoute("/deck-builders")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/deck-builders` },
      { property: "og:image", content: `${SITE_URL}/og-image.png` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: `${SITE_URL}/og-image.png` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/deck-builders` }],
    scripts: [
      jsonLdScript(breadcrumbSchema([{ name: "Deck builders", path: "/deck-builders" }])),
      // Same array the page renders — the markup cannot describe questions
      // the visitor does not see.
      jsonLdScript(faqPageSchema(DECK_BUILDERS_FAQ)),
    ],
  }),
  component: BuildDeckBuildersPage,
});
