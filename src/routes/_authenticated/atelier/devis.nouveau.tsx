import { createFileRoute } from "@tanstack/react-router";
import { QuoteBuilderPage } from "@/marketplace/pages/binder/quotes/QuoteBuilderPage";

export const Route = createFileRoute("/_authenticated/atelier/devis/nouveau")({
  // `?workId=` : « Créer un devis » depuis la fiche d'un ouvrage — le contact et le livre sont déjà
  // connus. Jamais une autorisation : le serveur vérifie que l'ouvrage est celui de l'atelier.
  validateSearch: (search: Record<string, unknown>): { workId?: string } =>
    typeof search.workId === "string" && search.workId.length <= 64 ? { workId: search.workId } : {},
  component: RouteComponent,
});

function RouteComponent() {
  const { workId } = Route.useSearch();
  return <QuoteBuilderPage workId={workId} />;
}
