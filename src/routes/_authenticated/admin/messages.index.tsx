import { createFileRoute } from "@tanstack/react-router";
import { AdminMessagesPage } from "@/marketplace/pages/admin/AdminWorkspacePages";
export const Route = createFileRoute("/_authenticated/admin/messages/")({ component: AdminMessagesPage });
