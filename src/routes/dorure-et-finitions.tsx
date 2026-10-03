import { createFileRoute } from "@tanstack/react-router";
import { CraftPage } from "@/marketplace/pages/crafts/CraftPage";
import { craftHead } from "@/marketplace/pages/crafts/craftHead";

/** Page par besoin « embellir » de Ma Reliure — contenu dans pages/crafts/craftPages.ts. */
export const Route = createFileRoute("/dorure-et-finitions")({
  head: () => craftHead("embellir"),
  component: () => <CraftPage slug="embellir" />,
});
