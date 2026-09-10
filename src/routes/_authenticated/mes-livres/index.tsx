import { createFileRoute } from "@tanstack/react-router";
import { MyBooksPage } from "@/marketplace/pages/customer/MyBooksPage";

export const Route = createFileRoute("/_authenticated/mes-livres/")({
  component: MyBooksPage,
});
