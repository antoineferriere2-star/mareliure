import { createFileRoute } from "@tanstack/react-router";
import { ContactsPage } from "@/marketplace/pages/binder/works/ContactsPage";

export const Route = createFileRoute("/_authenticated/atelier/contacts/")({
  component: ContactsPage,
});
