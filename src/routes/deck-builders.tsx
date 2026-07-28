import { createFileRoute } from "@tanstack/react-router";
import { BuildDeckBuildersPage } from "@/build/pages/public/BuildMarketingPages";
import { breadcrumbSchema, jsonLdScript } from "@/lib/structured-data";

const title = "Deck builders — Métré Build";
const description =
  "Qualify deck projects before the first sales call with a guided Deck Project Intake.";

export const Route = createFileRoute("/deck-builders")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/deck-builders" },
      { property: "og:image", content: "/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: "/og-image.png" },
    ],
    links: [{ rel: "canonical", href: "/deck-builders" }],
    scripts: [
      jsonLdScript(
        breadcrumbSchema([{ name: "Deck builders", path: "/deck-builders" }]),
      ),
    ],
  }),
  component: BuildDeckBuildersPage,
});
