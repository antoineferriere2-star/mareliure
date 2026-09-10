import { createFileRoute } from "@tanstack/react-router";
import { MyBookPage } from "@/marketplace/pages/customer/MyBookPage";

export const Route = createFileRoute("/_authenticated/mes-livres/$caseId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { caseId } = Route.useParams();
  return <MyBookPage caseId={caseId} />;
}
