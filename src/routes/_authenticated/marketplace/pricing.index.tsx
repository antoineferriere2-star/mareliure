import { createFileRoute } from "@tanstack/react-router";
import { PricingGridPage } from "@/marketplace/pages/admin/pricing/PricingGridPage";

export const Route = createFileRoute("/_authenticated/marketplace/pricing/")({
  component: PricingGridPage,
});
