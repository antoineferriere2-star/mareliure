import { createFileRoute } from "@tanstack/react-router";
import { CustomerCaseListPage } from "@/marketplace/pages/customer/CustomerCaseListPage";

export const Route = createFileRoute("/_authenticated/mes-livres/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { brand } = Route.useRouteContext();
  return <CustomerCaseListPage brand={brand} />;
}
