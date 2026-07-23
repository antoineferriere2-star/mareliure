import { createFileRoute } from "@tanstack/react-router";
import { BuildLegalPage } from "@/build/pages/public/BuildMarketingPages";

const title = "Privacy — Métré Build";
const description = "Métré Build private beta privacy summary.";

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
        "Métré Build collects information submitted through public beta and audit forms so the team can review requests and respond.",
        "Demo Project Brief data is fictional or stored locally in your browser unless you submit a production request.",
        "Real customer responses, runtime sessions and project briefs are not intended to be indexed or exposed publicly.",
      ]}
    />
  ),
});
