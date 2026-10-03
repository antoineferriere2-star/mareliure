import { createFileRoute } from "@tanstack/react-router";
import { CraftPage } from "@/marketplace/pages/crafts/CraftPage";
import { craftHead } from "@/marketplace/pages/crafts/craftHead";

/** Page par besoin « reparer » de Ma Reliure — contenu dans pages/crafts/craftPages.ts. */
export const Route = createFileRoute("/reparation-de-livres")({
  head: () => craftHead("reparer"),
  component: () => <CraftPage slug="reparer" />,
});
