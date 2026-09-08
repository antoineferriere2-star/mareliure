import { createFileRoute } from "@tanstack/react-router";
import { BinderListPage } from "@/marketplace/pages/admin/BinderListPage";

export const Route = createFileRoute("/_authenticated/marketplace/binders")({
  component: BinderListPage,
});
