/**
 * The relieur's own space. Authentication is enough to enter the layout; every
 * server function behind it independently checks that this account actually has
 * an approved relieur profile, and that the case being asked for was confided
 * to it. The layout is chrome, never a permission.
 */
import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { SignOutButton } from "@/marketplace/pages/SignOutButton";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyBinderCases } from "@/marketplace/services/marketplace.data.functions";

export const Route = createFileRoute("/_authenticated/atelier")({
  ssr: false,
  component: AtelierLayout,
});

const NAV_LINK =
  "inline-flex min-h-11 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const NAV_ACTIVE = { className: "text-foreground font-medium underline underline-offset-8" };

function AtelierLayout() {
  const fetchCases = useServerFn(listMyBinderCases);
  const cases = useQuery({ queryKey: ["marketplace", "binder", "cases"], queryFn: () => fetchCases(), retry: false });
  const newCount = (cases.data ?? []).filter((row) => row.state === "offered" || row.state === "invited").length;
  const unreadCount = (cases.data ?? []).reduce((total, row) => total + row.unreadCount, 0);
  return (
    <div className="min-h-screen bg-[#f7f2e8] text-[#241a12]">
      <header className="border-b border-[#3b2a1d]/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2">
          <Link to="/atelier" className="mr-2 font-serif text-lg">
            Ma Reliure · atelier
          </Link>
          <nav aria-label="Espace atelier" className="flex flex-wrap gap-1">
            <Link to="/atelier" activeOptions={{ exact: true }} activeProps={NAV_ACTIVE} className={NAV_LINK}>Aujourd'hui</Link>
            <Link to="/atelier/leads" activeProps={NAV_ACTIVE} className={NAV_LINK}>Leads{newCount > 0 && <span className="ml-1 rounded-full bg-foreground px-1.5 text-xs text-background">{newCount}</span>}</Link>
            <Link to="/atelier/devis" activeProps={NAV_ACTIVE} className={NAV_LINK}>Devis</Link>
            <Link to="/atelier/ouvrages" activeProps={NAV_ACTIVE} className={NAV_LINK}>
              Ouvrages
            </Link>
            <Link to="/atelier/messages" activeProps={NAV_ACTIVE} className={NAV_LINK}>Messages{unreadCount > 0 && <span className="ml-1 rounded-full bg-foreground px-1.5 text-xs text-background">{unreadCount}</span>}</Link>
            <Link to="/atelier/contacts" activeProps={NAV_ACTIVE} className={NAV_LINK}>
              Contacts
            </Link>
            <Link to="/atelier/factures" activeProps={NAV_ACTIVE} className={NAV_LINK}>Factures</Link>
            <Link to="/atelier/tarifs" activeProps={NAV_ACTIVE} className={NAV_LINK}>
              Prestations
            </Link>
          </nav>
          <div className="ml-auto">
            <SignOutButton label="Se déconnecter" signedInAs="Connecté en tant que" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">
        <Outlet />
      </main>
    </div>
  );
}
