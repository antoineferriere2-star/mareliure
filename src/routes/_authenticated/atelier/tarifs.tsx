import { createFileRoute } from "@tanstack/react-router";
import { TarifsPage } from "@/marketplace/pages/binder/quotes/TarifsPage";

export const Route = createFileRoute("/_authenticated/atelier/tarifs")({
  component: TarifsPage,
});
