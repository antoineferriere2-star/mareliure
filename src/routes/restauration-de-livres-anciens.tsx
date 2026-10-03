import { createFileRoute } from "@tanstack/react-router";
import { CraftPage } from "@/marketplace/pages/crafts/CraftPage";
import { craftHead } from "@/marketplace/pages/crafts/craftHead";

/** Page par besoin « restaurer » de Ma Reliure — contenu dans pages/crafts/craftPages.ts. */
export const Route = createFileRoute("/restauration-de-livres-anciens")({
  head: () => craftHead("restaurer"),
  component: () => <CraftPage slug="restaurer" />,
});
