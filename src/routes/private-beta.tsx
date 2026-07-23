import { createFileRoute } from "@tanstack/react-router";
import { BuildPrivateBetaPage } from "@/build/pages/public/BuildPublicFormPages";

const title = "Private beta — Métré Build";
const description =
  "Apply to become an early pilot partner in the Métré Build private beta.";

export const Route = createFileRoute("/private-beta")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/private-beta" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ],
    links: [{ rel: "canonical", href: "/private-beta" }],
  }),
  component: BuildPrivateBetaPage,
});
