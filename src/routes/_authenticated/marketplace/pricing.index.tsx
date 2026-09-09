import { createFileRoute } from "@tanstack/react-router";
import { PricingReferencePage } from "@/marketplace/pages/admin/PricingReferencePage";

export const Route = createFileRoute("/_authenticated/marketplace/pricing/")({
  component: PricingReferencePage,
});
