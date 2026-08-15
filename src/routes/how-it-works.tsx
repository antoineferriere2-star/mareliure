import { createFileRoute } from "@tanstack/react-router";
import { BuildHowItWorksPage } from "@/build/pages/public/BuildMarketingPages";
import { breadcrumbSchema, jsonLdScript, SITE_URL } from "@/lib/structured-data";

const title = "How Guided Lead Intake Works for Contractors — Métré Build";
const description =
  "Three steps: pick a Playbook, add it to your site, receive structured briefs. See what a guided intake collects that a contact form never asks for.";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/how-it-works` },
      { property: "og:image", content: `${SITE_URL}/og-image.png` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: `${SITE_URL}/og-image.png` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/how-it-works` }],
    scripts: [jsonLdScript(breadcrumbSchema([{ name: "How it works", path: "/how-it-works" }]))],
  }),
  component: BuildHowItWorksPage,
});
