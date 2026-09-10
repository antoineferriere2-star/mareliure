import { createFileRoute } from "@tanstack/react-router";
import { PricingSimulatorPage } from "@/marketplace/pages/admin/pricing/PricingSimulatorPage";

export const Route = createFileRoute("/_authenticated/marketplace/pricing/simulator")({
  component: PricingSimulatorPage,
});
