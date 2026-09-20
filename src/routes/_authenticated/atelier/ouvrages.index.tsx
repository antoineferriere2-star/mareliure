import { createFileRoute } from "@tanstack/react-router";
import { WorksPage } from "@/marketplace/pages/binder/works/WorksPage";

export const Route = createFileRoute("/_authenticated/atelier/ouvrages/")({
  component: WorksPage,
});
