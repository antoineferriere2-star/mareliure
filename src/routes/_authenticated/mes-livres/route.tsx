/**
 * « Mes livres » — l'espace client. Le layout est un décor : la garde est dans
 * les server functions, qui n'ouvrent un livre qu'au compte qui le possède.
 */
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { CustomerLayout } from "@/marketplace/pages/customer/CustomerLayout";

export const Route = createFileRoute("/_authenticated/mes-livres")({
  ssr: false,
  component: CustomerSpace,
});

function CustomerSpace() {
  return (
    <CustomerLayout>
      <Outlet />
    </CustomerLayout>
  );
}
