import { createFileRoute, redirect } from "@tanstack/react-router";
// Ancien lien anglais : une seule URL indexable, comme pour les autres langues.
export const Route = createFileRoute("/terms-of-use")({
  beforeLoad: () => {
    throw redirect({ href: "/en/terms-of-use", statusCode: 301 });
  },
});
