/**
 * "Mes livres" — the customer's space. As with the atelier layout, the gate is
 * in the server functions: a case is matched to the signed-in account by the
 * e-mail the visitor gave the intake, checked server-side against the Dossier.
 */
import { createFileRoute, Outlet, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/mes-livres")({
  ssr: false,
  component: CustomerLayout,
});

function CustomerLayout() {
  return (
    <div className="min-h-screen bg-[#f7f2e8] text-[#241a12]">
      <header className="border-b border-[#3b2a1d]/10">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-4">
          <Link to="/mes-livres" className="font-serif text-lg">
            Reliure
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">
        <Outlet />
      </main>
    </div>
  );
}
