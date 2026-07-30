import { createFileRoute } from "@tanstack/react-router";
import { BuildLegalPage } from "@/build/pages/public/BuildMarketingPages";
import { breadcrumbSchema, jsonLdScript, SITE_URL } from "@/lib/structured-data";

const title = "Privacy — Métré Build";
const description =
  "How Métré Build collects, uses and protects the information you submit through our audit, setup request and contact forms.";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/privacy` },
      { property: "og:image", content: `${SITE_URL}/og-image.png` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/privacy` }],
    scripts: [jsonLdScript(breadcrumbSchema([{ name: "Privacy", path: "/privacy" }]))],
  }),
  component: () => (
    <BuildLegalPage
      title="Privacy"
      paragraphs={[
        "Métré Build collects information submitted through website audit, setup request and contact forms so the team can review requests and respond.",
        "Demo Project Brief data is fictional or stored locally in your browser unless you submit a real request.",
        "Real customer responses, runtime sessions and project briefs are not intended to be indexed or exposed publicly.",
        "Categories of data collected: contact details (name, email), website URL, and any information you provide in a request form. Questions about this policy can be sent to contact@oppe.fr.",
      ]}
    />
  ),
});
