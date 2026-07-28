import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { BuildPublicHome } from "@/build/pages/public/BuildPublicHome";

const title = "Métré Build — Project discovery for project-based businesses";
const description =
  "Métré Build helps customers explain complex projects and gives sales teams structured, sales-ready Project Briefs. More helpful than a form, simpler than a custom configurator.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: "/og-image.png" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/` }],
    scripts: [
      jsonLdScript({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "Métré Build",
        url: `${SITE_URL}/`,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        publisher: { "@id": ORGANIZATION_ID },
        isPartOf: { "@id": WEBSITE_ID },
      }),
    ],
  }),
  component: HomeRoute,
});

// Supabase's configured Site URL sends magic-link / email-confirmation
// redirects here instead of the app page we requested via `emailRedirectTo`
// (its Redirect URLs allowlist needs that page added — a dashboard config
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
