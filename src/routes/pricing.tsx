import { createFileRoute } from "@tanstack/react-router";
import { BuildPricingPage } from "@/build/pages/public/BuildMarketingPages";
import { breadcrumbSchema, faqPageSchema, jsonLdScript, SITE_URL } from "@/lib/structured-data";
import { PRICING_FAQ } from "@/build/content/publicFaq";

const title = "Project Intake Pricing from $19.99/mo — Métré Build";
const description =
  "Plans from $19.99/mo by active Project Intakes and monthly Project Briefs. Every plan includes guided intake, AI-drafted briefs and the client portal.";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/pricing` },
      { property: "og:image", content: `${SITE_URL}/og-image.png` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: `${SITE_URL}/og-image.png` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/pricing` }],
    scripts: [
      jsonLdScript(breadcrumbSchema([{ name: "Pricing", path: "/pricing" }])),
      jsonLdScript(faqPageSchema(PRICING_FAQ)),
    ],
  }),
  component: BuildPricingPage,
});
