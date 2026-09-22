import { createFileRoute } from "@tanstack/react-router";
import { CaseMatchingPage } from "@/marketplace/pages/admin/CaseMatchingPage";
export const Route = createFileRoute("/_authenticated/admin/leads/$leadId")({
  component: RouteComponent,
});

function RouteComponent() { return <CaseMatchingPage caseId={Route.useParams().leadId} />; }
