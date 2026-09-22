import { createFileRoute } from "@tanstack/react-router";
import { BinderCasePage } from "@/marketplace/pages/binder/BinderCasePage";

export const Route = createFileRoute("/_authenticated/atelier/leads/$leadId")({
  component: RouteComponent,
});

function RouteComponent() { return <BinderCasePage caseId={Route.useParams().leadId} />; }
