import { createFileRoute } from "@tanstack/react-router";
import { BuildContactPage } from "@/build/pages/public/BuildPublicFormPages";
import { breadcrumbSchema, jsonLdScript, SITE_URL } from "@/lib/structured-data";

const title = "Contact - Métré Build";
const description =
  "Send a direct message to the Métré Build team about guided project intake, setup or support.";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/contact` },
      { property: "og:image", content: `${SITE_URL}/og-image.png` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: `${SITE_URL}/og-image.png` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/contact` }],
    scripts: [jsonLdScript(breadcrumbSchema([{ name: "Contact", path: "/contact" }]))],
  }),
  component: BuildContactPage,
});
