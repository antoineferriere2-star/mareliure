import { createFileRoute } from "@tanstack/react-router";
import { WorkPage } from "@/marketplace/pages/binder/works/WorkPage";

export const Route = createFileRoute("/_authenticated/atelier/ouvrages/$workId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { workId } = Route.useParams();
  return <WorkPage workId={workId} />;
}
