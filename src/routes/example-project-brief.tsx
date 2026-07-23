import { createFileRoute } from "@tanstack/react-router";
import { BuildExampleProjectBriefPage } from "@/build/pages/public/BuildMarketingPages";

const title = "Example Project Brief — Métré Build";
const description =
  "View a fictional deck project brief created for demonstration purposes.";

export const Route = createFileRoute("/example-project-brief")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "/example-project-brief" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ],
    links: [{ rel: "canonical", href: "/example-project-brief" }],
  }),
  component: BuildExampleProjectBriefPage,
});
