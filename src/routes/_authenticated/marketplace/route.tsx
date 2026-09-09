/**
 * The marketplace back-office. Gated by the same `requireBuildAdmin` server
 * function the Métré admin uses — one admin role, checked in the database, not
 * a second bespoke notion of "who runs the marketplace".
 */
import { createFileRoute, Outlet, Link, redirect, isRedirect } from "@tanstack/react-router";
import { requireBuildAdmin } from "@/build/services/admin.functions";
import { BookMarked, Inbox, Receipt } from "lucide-react";

export const Route = createFileRoute("/_authenticated/marketplace")({
  ssr: false,
  beforeLoad: async () => {
    try {
      return { admin: await requireBuildAdmin() };
    } catch (err) {
      if (isRedirect(err)) throw err;
      throw redirect({ to: "/auth" });
    }
  },
  component: MarketplaceAdminLayout,
});

const NAV = [
  { to: "/marketplace/cases", label: "Demandes", icon: Inbox },
  { to: "/marketplace/binders", label: "Relieurs", icon: BookMarked },
  { to: "/marketplace/pricing", label: "Tarifs", icon: Receipt },
] as const;

function MarketplaceAdminLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-6 px-5 py-4">
          <Link to="/marketplace/cases" className="font-serif text-lg">
            Ma Reliure · back-office
          </Link>
          <nav className="flex gap-1">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground [&.active]:bg-muted [&.active]:text-foreground"
              >
                <item.icon className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8">
        <Outlet />
      </main>
    </div>
  );
}
