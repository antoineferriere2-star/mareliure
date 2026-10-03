import { createFileRoute } from "@tanstack/react-router";
import { CraftPage } from "@/marketplace/pages/crafts/CraftPage";
import { craftHead } from "@/marketplace/pages/crafts/craftHead";

/** Page par besoin « relier » de Ma Reliure — contenu dans pages/crafts/craftPages.ts. */
export const Route = createFileRoute("/reliure-de-livres")({
  head: () => craftHead("relier"),
  component: () => <CraftPage slug="relier" />,
});
