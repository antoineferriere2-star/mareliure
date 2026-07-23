import { createFileRoute } from "@tanstack/react-router";
import { BuildLegalPage } from "@/build/pages/public/BuildMarketingPages";

const title = "Terms — Métré Build";
const description = "Métré Build private beta terms summary.";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/terms" },
    ],
    links: [{ rel: "canonical", href: "/terms" }],
  }),
  component: () => (
    <BuildLegalPage
      title="Terms"
      paragraphs={[
        "The public MVP is provided for evaluation and pilot discussions only.",
        "The Deck Project Demo does not produce a guaranteed quote, engineering assessment or regulatory review.",
        "Pilot access is invitation-based and may change while the product is in private beta.",
      ]}
    />
  ),
});
