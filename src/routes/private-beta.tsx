import { createFileRoute } from "@tanstack/react-router";
import { BuildPrivateBetaPage } from "@/build/pages/public/BuildPublicFormPages";
import { breadcrumbSchema, jsonLdScript, SITE_URL } from "@/lib/structured-data";

const title = "Request a setup review — Métré Build";
const description =
  "Tell us about your business — we'll help you set up a guided Project Intake for your website.";

export const Route = createFileRoute("/private-beta")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/private-beta` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/private-beta` }],
    scripts: [
      jsonLdScript(
        breadcrumbSchema([
          { name: "Request a setup review", path: "/private-beta" },
        ]),
      ),
    ],
  }),
  component: BuildPrivateBetaPage,
});
