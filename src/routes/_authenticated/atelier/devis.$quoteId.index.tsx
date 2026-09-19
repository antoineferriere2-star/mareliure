import { createFileRoute } from "@tanstack/react-router";
import { QuoteDetailPage } from "@/marketplace/pages/binder/quotes/DocumentPages";

export const Route = createFileRoute("/_authenticated/atelier/devis/$quoteId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { quoteId } = Route.useParams();
  return <QuoteDetailPage quoteId={quoteId} />;
}
