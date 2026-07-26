import { createFileRoute } from "@tanstack/react-router";
import { BuildLegalPage } from "@/build/pages/public/BuildMarketingPages";

const title = "Terms — Métré Build";
const description = "Métré Build terms summary.";

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
        "Métré Build is provided for project discovery and qualification purposes only.",
        "The Deck Project Demo does not produce a guaranteed quote, engineering assessment or regulatory review.",
        "Access and available features may change as the product evolves. Contact contact@oppe.fr with any questions.",
      ]}
    />
  ),
});
