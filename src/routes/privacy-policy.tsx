import { createFileRoute, redirect } from "@tanstack/react-router";
// Ancien lien anglais : une seule URL indexable, comme pour les autres langues.
export const Route = createFileRoute("/privacy-policy")({
  beforeLoad: () => {
    throw redirect({ href: "/en/privacy-policy", statusCode: 301 });
  },
});
