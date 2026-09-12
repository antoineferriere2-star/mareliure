/**
 * "Mes livres" — the customer's space. As with the atelier layout, the gate is
 * in the server functions: a case is matched to the signed-in account by the
 * e-mail the visitor gave the intake, checked server-side against the Dossier.
 */
import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { isMaReliure } from "@/brand";
import { getRequestMarketplaceBrand } from "@/marketplace/brand/resolveRequestBrand.server";
import { MARKETPLACE_BRAND_CONFIGS } from "@/marketplace/brand/brandConfig";

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
  const displayName =
    brand === "FINE_BINDERY"
      ? MARKETPLACE_BRAND_CONFIGS.FINE_BINDERY.displayName
      : MARKETPLACE_BRAND_CONFIGS.MA_RELIURE.displayName;
  return (
    <div className="min-h-screen bg-[#f7f2e8] text-[#241a12]">
      <header className="border-b border-[#3b2a1d]/10">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-4">
          <Link to="/mes-livres" className="font-serif text-lg">
            {displayName}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">
        <Outlet />
      </main>
    </div>
  );
}
