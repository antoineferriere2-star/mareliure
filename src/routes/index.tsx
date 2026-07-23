import { createFileRoute } from "@tanstack/react-router";
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
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Métré Build",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
        }),
      },
    ],
  }),
  component: BuildPublicHome,
});
