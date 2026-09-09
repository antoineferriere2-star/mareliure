import { createFileRoute } from "@tanstack/react-router";
import { RateCardPage } from "@/marketplace/pages/admin/RateCardPage";

export const Route = createFileRoute("/_authenticated/marketplace/pricing/$binderId")({
  component: RateCardRoute,
});

function RateCardRoute() {
  const { binderId } = Route.useParams();
  return <RateCardPage binderId={binderId} />;
}
