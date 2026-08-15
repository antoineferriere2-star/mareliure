import { createFileRoute } from "@tanstack/react-router";
import { BuildFreeInquiryAuditPage } from "@/build/pages/public/BuildFreeInquiryAuditPage";
import { breadcrumbSchema, jsonLdScript, SITE_URL } from "@/lib/structured-data";

const title = "Free Contractor Website Lead-Form Audit — Métré Build";
const description =
  "Paste your website address and see what your current contact form misses. Business type, services and gaps detected in seconds. No account, no email.";

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
