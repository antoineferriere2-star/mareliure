import { createFileRoute } from "@tanstack/react-router";
import { BuildLegalPage } from "@/build/pages/public/BuildMarketingPages";
import { breadcrumbSchema, jsonLdScript, SITE_URL } from "@/lib/structured-data";

const title = "Terms — Métré Build";
const description =
  "The terms that apply when you use Métré Build for project discovery, guided intake and Project Brief qualification.";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/terms` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/terms` }],
    scripts: [
      jsonLdScript(breadcrumbSchema([{ name: "Terms", path: "/terms" }])),
    ],
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
