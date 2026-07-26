import {
  createFileRoute,
  Outlet,
  Link,
  redirect,
  isRedirect,
  useRouter,
  useNavigate,
} from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { requireWorkspaceAccess } from "@/build/services/workspace.functions";

export const Route = createFileRoute("/_authenticated/portal")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const access = await requireWorkspaceAccess();
      return { access };
    } catch (err) {
      if (isRedirect(err)) throw err;
      throw redirect({ to: "/auth" });
    }
  },
  component: PortalLayout,
});

function PortalLayout() {
  const { access } = Route.useRouteContext();
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
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/portal" className="text-sm font-semibold">
            Espace Client · Métré Build
          </Link>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{access.email ?? access.userId.slice(0, 8)}</span>
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
      <nav className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl gap-4 px-4 text-sm">
          <Link
            to="/portal"
            activeOptions={{ exact: true }}
            activeProps={{ className: "border-primary text-foreground font-medium" }}
            className="border-b-2 border-transparent py-3 text-muted-foreground hover:text-foreground"
          >
            Mes Dossiers
          </Link>
          <Link
            to="/portal/billing"
            activeProps={{ className: "border-primary text-foreground font-medium" }}
            className="border-b-2 border-transparent py-3 text-muted-foreground hover:text-foreground"
          >
            Facturation
          </Link>
        </div>
      </nav>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
