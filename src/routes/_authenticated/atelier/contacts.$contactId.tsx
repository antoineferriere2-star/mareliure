import { createFileRoute } from "@tanstack/react-router";
import { ContactPage } from "@/marketplace/pages/binder/works/ContactPage";

export const Route = createFileRoute("/_authenticated/atelier/contacts/$contactId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { contactId } = Route.useParams();
  return <ContactPage contactId={contactId} />;
}
