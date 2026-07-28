import { createFileRoute } from "@tanstack/react-router";
import { BuildHowItWorksPage } from "@/build/pages/public/BuildMarketingPages";
import { breadcrumbSchema, jsonLdScript } from "@/lib/structured-data";

const title = "How Métré Build works";
const description =
  "Learn how Playbooks, Project Intakes and Project Briefs turn website inquiries into sales-ready context.";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/how-it-works` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/how-it-works` }],
    scripts: [
      jsonLdScript(
        breadcrumbSchema([{ name: "How it works", path: "/how-it-works" }]),
      ),
    ],
  }),
  component: BuildHowItWorksPage,
});
