import { createFileRoute } from "@tanstack/react-router";
import { AdminWorkshopsPage } from "@/marketplace/pages/admin/AdminWorkspacePages";
export const Route = createFileRoute("/_authenticated/admin/ateliers/")({ component: AdminWorkshopsPage });
