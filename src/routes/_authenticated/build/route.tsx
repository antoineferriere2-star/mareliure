import { createFileRoute, Outlet, Link, redirect, useRouter, useNavigate } from "@tanstack/react-router";
import { isRedirect } from "@tanstack/react-router";
import { requireBuildAdmin } from "@/build/services/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

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
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Link to="/build" className="text-sm font-semibold">
              Métré Build · Admin
            </Link>
            <nav className="flex items-center gap-3 text-sm text-muted-foreground">
              <Link
                to="/build"
                className="hover:text-foreground"
                activeOptions={{ exact: true }}
                activeProps={{ className: "text-foreground font-medium" }}
              >
                Dashboard
              </Link>
            </nav>
          </div>
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
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
