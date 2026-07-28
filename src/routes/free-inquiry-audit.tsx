import { createFileRoute } from "@tanstack/react-router";
import { BuildFreeInquiryAuditPage } from "@/build/pages/public/BuildPublicFormPages";
import { breadcrumbSchema, jsonLdScript } from "@/lib/structured-data";

const title = "Free inquiry audit — Métré Build";
const description =
  "Send us your website. We'll review how your inquiry flow captures project details and identify the biggest gaps.";

export const Route = createFileRoute("/free-inquiry-audit")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/free-inquiry-audit" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ],
    links: [{ rel: "canonical", href: "/free-inquiry-audit" }],
  }),
  component: BuildFreeInquiryAuditPage,
});
