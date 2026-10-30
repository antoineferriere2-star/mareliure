import { createFileRoute, redirect } from "@tanstack/react-router";
// Ancien lien anglais : une seule URL indexable, comme pour les autres langues.
export const Route = createFileRoute("/terms-of-sale")({
  beforeLoad: () => {
    throw redirect({ href: "/en/terms-of-sale", statusCode: 301 });
  },
});
