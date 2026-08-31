import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { BuildPublicHome } from "@/build/pages/public/BuildPublicHome";
import { jsonLdScript, ORGANIZATION_ID, SITE_URL, WEBSITE_ID } from "@/lib/structured-data";

const title = "Qualify Contractor Leads Before the First Call — Métré Build";
const description =
  "Contractors lose the first call rediscovering the project. A guided intake collects scope, dimensions, photos and budget first. See a real brief.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/` },
      { property: "og:image", content: `${SITE_URL}/og-image.png` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: `${SITE_URL}/og-image.png` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/` }],
    scripts: [
      jsonLdScript({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#software`,
        name: "Métré Build",
        url: `${SITE_URL}/`,
        image: `${SITE_URL}/og-image.png`,
        description,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        offers: {
          "@type": "Offer",
          price: "19.99",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
          url: `${SITE_URL}/private-beta`,
        },
        publisher: { "@id": ORGANIZATION_ID },
        isPartOf: { "@id": WEBSITE_ID },
      }),
    ],
  }),
  component: HomeRoute,
});

// Supabase's configured Site URL sends magic-link / email-confirmation
// redirects here instead of the app page we requested via `emailRedirectTo`
// (its Redirect URLs allowlist needs that page added - a dashboard config
// fix, not something this code can control). Until then, catch a stray
// unprocessed session token in the hash and hand it to /auth, which already
// knows how to detect the session and route to /build or /portal.
function HomeRoute() {
  useEffect(() => {
    if (window.location.hash.includes("access_token")) {
      window.location.replace(`/auth${window.location.hash}`);
    }
  }, []);
  return <BuildPublicHome />;
}
