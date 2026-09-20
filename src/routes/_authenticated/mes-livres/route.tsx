/**
 * "Mes livres" — the customer's space. As with the atelier layout, the gate is
 * in the server functions: a case is matched to the signed-in account by the
 * e-mail the visitor gave the intake, checked server-side against the Dossier.
 */
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { isMaReliure } from "@/brand";
import { getRequestMarketplaceBrand } from "@/marketplace/brand/resolveRequestBrand.server";
import { CustomerPortalShell } from "@/marketplace/pages/customer/CustomerPortalShell";
import { customerCopy, customerLocaleForBrand } from "@/marketplace/customer/customerPresentation";
import { SignOutButton } from "@/marketplace/pages/SignOutButton";

export const Route = createFileRoute("/_authenticated/mes-livres")({
  ssr: false,
  // Resolved once for the whole "My Books" subtree — CustomerCaseListPage.tsx
  // and CustomerCasePage.tsx read it back via Route.useRouteContext() rather
  // than each making their own server round trip. `getRequestMarketplaceBrand`
  // is a createServerFn: called from this client-only route it still reads
  // the correct Host, because the RPC fetch itself carries the browser's
  // current origin.
  beforeLoad: async () => ({
    brand: isMaReliure ? await getRequestMarketplaceBrand() : null,
  }),
  component: CustomerLayout,
});

function CustomerLayout() {
  const { brand } = Route.useRouteContext();
  const copy = customerCopy(customerLocaleForBrand(brand));
  return (
    <CustomerPortalShell
      brand={brand}
      account={<SignOutButton label={copy.signOut} signedInAs={copy.signedInAs} />}
    >
      <Outlet />
    </CustomerPortalShell>
  );
}
