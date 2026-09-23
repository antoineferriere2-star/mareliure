import { createFileRoute } from "@tanstack/react-router";
import { PublicProfilePage } from "@/marketplace/pages/binder/PublicProfilePage";

export const Route = createFileRoute("/_authenticated/atelier/profil-public")({
  component: PublicProfilePage,
});
