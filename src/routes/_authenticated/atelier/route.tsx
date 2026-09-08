/**
 * The relieur's own space. Authentication is enough to enter the layout; every
 * server function behind it independently checks that this account actually has
 * an approved relieur profile, and that the case being asked for was confided
 * to it. The layout is chrome, never a permission.
 */
import { createFileRoute, Outlet, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/atelier")({
  ssr: false,
  component: AtelierLayout,
});

function AtelierLayout() {
  return (
    <div className="min-h-screen bg-[#f7f2e8] text-[#241a12]">
      <header className="border-b border-[#3b2a1d]/10">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-4">
          <Link to="/atelier" className="font-serif text-lg">
            Reliure · atelier
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">
        <Outlet />
      </main>
    </div>
  );
}
