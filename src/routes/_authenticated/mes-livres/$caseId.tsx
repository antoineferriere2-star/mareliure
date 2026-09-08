import { createFileRoute } from "@tanstack/react-router";
import { CustomerCasePage } from "@/marketplace/pages/customer/CustomerCasePage";

export const Route = createFileRoute("/_authenticated/mes-livres/$caseId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { caseId } = Route.useParams();
  return <CustomerCasePage caseId={caseId} />;
}
