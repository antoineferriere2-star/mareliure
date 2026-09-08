import { createFileRoute } from "@tanstack/react-router";
import { CaseMatchingPage } from "@/marketplace/pages/admin/CaseMatchingPage";

export const Route = createFileRoute("/_authenticated/marketplace/cases/$caseId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { caseId } = Route.useParams();
  return <CaseMatchingPage caseId={caseId} />;
}
