import { createFileRoute, redirect } from "@tanstack/react-router";
// Ancien lien anglais : une seule URL indexable, comme pour les autres langues.
export const Route = createFileRoute("/legal-notice")({
  beforeLoad: () => {
    throw redirect({ href: "/en/legal-notice", statusCode: 301 });
  },
});
