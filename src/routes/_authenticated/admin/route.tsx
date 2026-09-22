import { createFileRoute, Outlet, Link, redirect, isRedirect } from "@tanstack/react-router";
import { requireBuildAdmin } from "@/build/services/admin.functions";
import { SignOutButton } from "@/marketplace/pages/SignOutButton";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    try { return { admin: await requireBuildAdmin() }; }
    catch (err) { if (isRedirect(err)) throw err; throw redirect({ to: "/auth" }); }
  },
  component: AdminLayout,
});

const NAV = [
  ["/admin", "Pilotage"], ["/admin/ateliers", "Ateliers"],
  ["/admin/leads", "Leads"], ["/admin/messages", "Messages"],
  ["/marketplace/pricing", "Tarifs"],
] as const;

function AdminLayout() {
  return <div className="min-h-screen bg-background text-foreground">
    <header className="border-b border-border bg-card"><div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-5 py-3">
      <Link to="/admin" className="mr-2 font-serif text-lg">Ma Reliure · admin</Link>
      <nav aria-label="Administration Ma Reliure" className="flex flex-wrap gap-1">{NAV.map(([to, label]) => <Link key={to} to={to} className="inline-flex min-h-11 items-center rounded-md px-3 text-sm hover:bg-muted [&.active]:bg-muted [&.active]:font-medium">{label}</Link>)}</nav>
      <div className="ml-auto"><SignOutButton label="Se déconnecter" signedInAs="Connecté en tant que" /></div>
    </div></header>
    <main className="mx-auto max-w-7xl px-5 py-8"><Outlet /></main>
  </div>;
}
