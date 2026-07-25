import { createFileRoute, Outlet, Link, redirect, useRouter, useNavigate } from "@tanstack/react-router";
import { isRedirect } from "@tanstack/react-router";
import { requireBuildAdmin } from "@/build/services/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Rocket,
  ClipboardList,
  BookOpen,
  FolderKanban,
  Brain,
  Settings,
  Inbox,
  Building2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/build")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const admin = await requireBuildAdmin();
      return { admin };
    } catch (err) {
      if (isRedirect(err)) throw err;
      throw redirect({ to: "/auth" });
    }
  },
  component: BuildAdminLayout,
});

type NavItem = {
  to: "/build/dashboard" | "/build/missions" | "/build/playbooks" | "/build/dossiers" | "/build/knowledge" | "/build/settings" | "/build/onboarding" | "/build/requests" | "/build/workspaces";
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

const navItems: NavItem[] = [
  { to: "/build/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/build/onboarding", label: "Onboarding", icon: Rocket },
  { to: "/build/missions", label: "Missions", icon: ClipboardList },
  { to: "/build/playbooks", label: "Playbooks", icon: BookOpen },
  { to: "/build/dossiers", label: "Dossiers", icon: FolderKanban },
  { to: "/build/requests", label: "Requests", icon: Inbox },
  { to: "/build/workspaces", label: "Espaces Client", icon: Building2 },
  { to: "/build/knowledge", label: "Knowledge", icon: Brain },
  { to: "/build/settings", label: "Settings", icon: Settings },
];

function BuildAdminLayout() {
  const { admin } = Route.useRouteContext();
  const router = useRouter();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await router.invalidate();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to="/build/dashboard" className="flex items-center gap-2 text-sm font-semibold">
            <span>Métré Build AI · Admin</span>
            <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
              Dev · Private beta
            </span>
          </Link>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{admin.email ?? admin.userId.slice(0, 8)}</span>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-8">
        <aside className="w-56 shrink-0">
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  activeProps={{ className: "bg-accent text-accent-foreground font-medium" }}
                  activeOptions={item.exact ? { exact: true } : undefined}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
