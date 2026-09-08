import { createFileRoute } from "@tanstack/react-router";
import { BinderDashboardPage } from "@/marketplace/pages/binder/BinderDashboardPage";

export const Route = createFileRoute("/_authenticated/atelier/")({
  component: BinderDashboardPage,
});
