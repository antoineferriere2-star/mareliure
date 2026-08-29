import { createFileRoute } from "@tanstack/react-router";
import { BuildExampleProjectBriefPage } from "@/build/pages/public/BuildMarketingPages";
import {
  breadcrumbSchema,
  jsonLdScript,
  ORGANIZATION_ID,
  SITE_URL,
  WEBSITE_ID,
} from "@/lib/structured-data";

const title = "Example Project Brief — See the Sales Output — Métré Build";
const description =
  "A fictional Project Brief showing visitor answers, derived values, missing information and the next commercial action. Real structure, demo data.";

export const Route = createFileRoute("/example-project-brief")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: `${SITE_URL}/example-project-brief` },
      { property: "og:image", content: `${SITE_URL}/og-image.png` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: `${SITE_URL}/og-image.png` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/example-project-brief` }],
    scripts: [
      jsonLdScript({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: "Example Project Brief — Métré Build",
        description,
        mainEntityOfPage: `${SITE_URL}/example-project-brief`,
        datePublished: "2026-01-15",
        author: { "@id": ORGANIZATION_ID },
        publisher: { "@id": ORGANIZATION_ID },
        isPartOf: { "@id": WEBSITE_ID },
      }),
      jsonLdScript(
        breadcrumbSchema([{ name: "Example Project Brief", path: "/example-project-brief" }]),
      ),
    ],
  }),
  component: BuildExampleProjectBriefPage,
});
