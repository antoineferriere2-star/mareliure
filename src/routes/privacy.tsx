import { createFileRoute } from "@tanstack/react-router";
import { BuildLegalPage } from "@/build/pages/public/BuildMarketingPages";
import { breadcrumbSchema, jsonLdScript } from "@/lib/structured-data";

const title = "Privacy — Métré Build";
const description = "Métré Build privacy summary.";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/privacy" },
    ],
    links: [{ rel: "canonical", href: "/privacy" }],
  }),
  component: () => (
    <BuildLegalPage
      title="Privacy"
      paragraphs={[
        "Métré Build collects information submitted through website audit and setup request forms so the team can review requests and respond.",
        "Demo Project Brief data is fictional or stored locally in your browser unless you submit a real request.",
        "Real customer responses, runtime sessions and project briefs are not intended to be indexed or exposed publicly.",
        "Categories of data collected: contact details (name, email), website URL, and any information you provide in a request form. Questions about this policy can be sent to contact@oppe.fr.",
      ]}
    />
  ),
});
