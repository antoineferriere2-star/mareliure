import { createFileRoute } from "@tanstack/react-router";
import { DECK_DEMO_PUBLIC_TOKEN } from "@/build/constants";
import { MissionRuntime } from "@/build/pages/public/MissionRuntime";
import { SITE_URL } from "@/lib/structured-data";

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
      { property: "og:url", content: `${SITE_URL}/demo/deck-project` },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/demo/deck-project` }],
  }),
  component: () => <MissionRuntime publicToken={DECK_DEMO_PUBLIC_TOKEN} />,
});
