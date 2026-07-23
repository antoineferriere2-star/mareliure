import { createFileRoute } from "@tanstack/react-router";
import { BuildHowItWorksPage } from "@/build/pages/public/BuildMarketingPages";

const title = "How Métré Build works";
const description =
  "Learn how Playbooks, Project Missions and Project Briefs turn website inquiries into sales-ready context.";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/how-it-works" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ],
    links: [{ rel: "canonical", href: "/how-it-works" }],
  }),
  component: BuildHowItWorksPage,
});
