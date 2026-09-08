import { createFileRoute } from "@tanstack/react-router";
import { CaseListPage } from "@/marketplace/pages/admin/CaseListPage";

export const Route = createFileRoute("/_authenticated/marketplace/cases/")({
  component: CaseListPage,
});
