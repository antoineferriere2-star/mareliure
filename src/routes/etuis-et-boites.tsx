import { createFileRoute } from "@tanstack/react-router";
import { CraftPage } from "@/marketplace/pages/crafts/CraftPage";
import { craftHead } from "@/marketplace/pages/crafts/craftHead";

/** Page par besoin « proteger » de Ma Reliure — contenu dans pages/crafts/craftPages.ts. */
export const Route = createFileRoute("/etuis-et-boites")({
  head: () => craftHead("proteger"),
  component: () => <CraftPage slug="proteger" />,
});
