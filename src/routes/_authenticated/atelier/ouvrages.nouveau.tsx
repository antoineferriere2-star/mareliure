import { createFileRoute } from "@tanstack/react-router";
import { WorkFormPage } from "@/marketplace/pages/binder/works/WorkFormPage";

export const Route = createFileRoute("/_authenticated/atelier/ouvrages/nouveau")({
  // `?contactId=` : « Nouvel ouvrage » depuis la fiche d'un contact — le contact est déjà choisi.
  validateSearch: (search: Record<string, unknown>): { contactId?: string } =>
    typeof search.contactId === "string" && search.contactId.length <= 64 ? { contactId: search.contactId } : {},
  component: RouteComponent,
});

function RouteComponent() {
  const { contactId } = Route.useSearch();
  return <WorkFormPage contactId={contactId} />;
}
