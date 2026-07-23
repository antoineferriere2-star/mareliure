import { createFileRoute } from "@tanstack/react-router";
import { BuildDeckProjectDemoPage } from "@/build/pages/public/BuildDeckProjectDemoPage";

const title = "Deck Project Demo — Métré Build";
const description =
  "Try a guided Deck Project Mission and generate an example Project Brief.";

export const Route = createFileRoute("/demo/deck-project")({
  ssr: false,
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/demo/deck-project" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ],
    links: [{ rel: "canonical", href: "/demo/deck-project" }],
  }),
  component: BuildDeckProjectDemoPage,
});
