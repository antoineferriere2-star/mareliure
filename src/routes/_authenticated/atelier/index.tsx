import { createFileRoute } from "@tanstack/react-router";
import { WorkshopDashboardPage } from "@/marketplace/pages/binder/WorkshopDashboardPage";

export const Route = createFileRoute("/_authenticated/atelier/")({
  component: WorkshopDashboardPage,
});
