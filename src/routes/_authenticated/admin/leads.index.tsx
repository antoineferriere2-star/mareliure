import { createFileRoute } from "@tanstack/react-router";
import { AdminLeadsPage } from "@/marketplace/pages/admin/AdminWorkspacePages";
export const Route = createFileRoute("/_authenticated/admin/leads/")({ component: AdminLeadsPage });
