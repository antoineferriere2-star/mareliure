import { createFileRoute } from "@tanstack/react-router";
import { BinderCasePage } from "@/marketplace/pages/binder/BinderCasePage";

export const Route = createFileRoute("/_authenticated/atelier/cases/$caseId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { caseId } = Route.useParams();
  return <BinderCasePage caseId={caseId} />;
}
