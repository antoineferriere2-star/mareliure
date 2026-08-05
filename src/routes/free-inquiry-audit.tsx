import { createFileRoute } from "@tanstack/react-router";
import { BuildFreeInquiryAuditPage } from "@/build/pages/public/BuildFreeInquiryAuditPage";
import { breadcrumbSchema, jsonLdScript, SITE_URL } from "@/lib/structured-data";

const title = "Free Website Analysis — Métré Build";
const description =
  "Enter your website URL. See what Métré Build detects about your business and what a guided project intake would look like for your customers.";

export const Route = createFileRoute("/free-inquiry-audit")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/free-inquiry-audit` },
      { property: "og:image", content: `${SITE_URL}/og-image.png` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: `${SITE_URL}/og-image.png` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/free-inquiry-audit` }],
    scripts: [
      jsonLdScript(
        breadcrumbSchema([{ name: "Free website analysis", path: "/free-inquiry-audit" }]),
      ),
    ],
  }),
  component: BuildFreeInquiryAuditPage,
});
