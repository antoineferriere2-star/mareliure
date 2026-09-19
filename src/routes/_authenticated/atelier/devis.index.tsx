import { createFileRoute } from "@tanstack/react-router";
import { QuotesListPage } from "@/marketplace/pages/binder/quotes/QuotesListPage";

export const Route = createFileRoute("/_authenticated/atelier/devis/")({
  component: QuotesListPage,
});
