import { createFileRoute } from "@tanstack/react-router";
import { QuoteBuilderPage } from "@/marketplace/pages/binder/quotes/QuoteBuilderPage";

export const Route = createFileRoute("/_authenticated/atelier/devis/$quoteId/modifier")({
  component: RouteComponent,
});

function RouteComponent() {
  const { quoteId } = Route.useParams();
  return <QuoteBuilderPage quoteId={quoteId} />;
}
