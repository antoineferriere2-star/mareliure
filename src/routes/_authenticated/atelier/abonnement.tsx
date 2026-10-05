import { createFileRoute } from "@tanstack/react-router";
import { WorkshopSubscriptionPage } from "@/marketplace/pages/binder/WorkshopSubscriptionPage";
export const Route = createFileRoute("/_authenticated/atelier/abonnement")({
  component: WorkshopSubscriptionPage,
});
