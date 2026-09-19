import { createFileRoute } from "@tanstack/react-router";
import { InvoiceDetailPage } from "@/marketplace/pages/binder/quotes/DocumentPages";

export const Route = createFileRoute("/_authenticated/atelier/factures/$invoiceId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { invoiceId } = Route.useParams();
  return <InvoiceDetailPage invoiceId={invoiceId} />;
}
