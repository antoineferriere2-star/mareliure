import { createFileRoute } from "@tanstack/react-router";
import { QuoteBuilderPage } from "@/marketplace/pages/binder/quotes/QuoteBuilderPage";

export const Route = createFileRoute("/_authenticated/atelier/devis/nouveau")({
  component: () => <QuoteBuilderPage />,
});
