import { createFileRoute } from "@tanstack/react-router";
import { WorkFormPage } from "@/marketplace/pages/binder/works/WorkFormPage";

export const Route = createFileRoute("/_authenticated/atelier/ouvrages/$workId/modifier")({
  component: RouteComponent,
});

function RouteComponent() {
  const { workId } = Route.useParams();
  return <WorkFormPage workId={workId} />;
}
