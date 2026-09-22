import { createFileRoute } from "@tanstack/react-router";
import { AdminTodayPage } from "@/marketplace/pages/admin/AdminWorkspacePages";
export const Route = createFileRoute("/_authenticated/admin/")({ component: AdminTodayPage });
