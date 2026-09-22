import { createFileRoute } from "@tanstack/react-router";
import { AdminWorkshopPage } from "@/marketplace/pages/admin/AdminWorkspacePages";
export const Route = createFileRoute("/_authenticated/admin/ateliers/$binderId")({
  component: RouteComponent,
});

function RouteComponent() { return <AdminWorkshopPage binderId={Route.useParams().binderId} />; }
