import { createFileRoute } from "@tanstack/react-router";
import { WorkshopCasePage } from "@/marketplace/pages/binder/WorkshopCasePage";

export const Route = createFileRoute("/_authenticated/atelier/cases/$caseId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { caseId } = Route.useParams();
  return <WorkshopCasePage caseId={caseId} />;
}
