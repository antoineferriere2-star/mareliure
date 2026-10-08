import { createFileRoute } from "@tanstack/react-router";
import { AdminDashboardPage } from "@/marketplace/pages/admin/AdminDashboardPage";
export const Route = createFileRoute("/_authenticated/admin/")({ component: AdminDashboardPage });
