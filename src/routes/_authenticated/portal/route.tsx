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
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { requireWorkspaceAccess } from "@/build/services/workspace.functions";
import { listMyWorkspaces } from "@/build/services/portal.data.functions";
import { ensureMyWorkspace } from "@/build/services/provisionWorkspace.functions";

export const Route = createFileRoute("/_authenticated/portal")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const access = await requireWorkspaceAccess();
      return { access };
    } catch (err) {
      if (isRedirect(err)) throw err;
      // Authenticated but no workspace yet (legacy account, race after
      // sign-up). Provision once — the routine is idempotent server-side —
      // then retry exactly once. Never loops.
      try {
        const result = await ensureMyWorkspace({ data: {} });
        if (result.status === "admin") throw redirect({ to: "/build" });
        const access = await requireWorkspaceAccess();
        return { access };
      } catch (retryErr) {
        if (isRedirect(retryErr)) throw retryErr;
        throw redirect({ to: "/auth" });
      }
    }
  },
  component: PortalLayout,
});

function PortalLayout() {
  const { access } = Route.useRouteContext();
  // An internal Sales / Demos workspace has a prospect list and no billing at
  // all — the two server functions behind that tab answer 404 for it, so
  // linking there would be a dead end. Read from the same cached query the
  // pages use; while it loads, the nav shows the client shape, which is the
  // safe default (it links to nothing an internal agent may not open).
  const fetchWorkspaces = useServerFn(listMyWorkspaces);
  const { data: workspaces } = useQuery({
    queryKey: ["portal", "workspaces"] as const,
    queryFn: () => fetchWorkspaces(),
  });
  const isInternalSales = (workspaces ?? []).some((workspace) => workspace.isInternalSales);
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
            {isInternalSales ? "Métré Sales · Demos" : "Client Portal · Métré Build"}
          </Link>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{access.email ?? access.userId.slice(0, 8)}</span>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              Sign out
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
            Project Briefs
          </Link>
          {isInternalSales && (
            <Link
              to="/portal/demos"
              activeProps={{ className: "border-primary text-foreground font-medium" }}
              className="border-b-2 border-transparent py-3 text-muted-foreground hover:text-foreground"
            >
              Prospect demos
            </Link>
          )}
          <Link
            to="/portal/missions"
            activeProps={{ className: "border-primary text-foreground font-medium" }}
            className="border-b-2 border-transparent py-3 text-muted-foreground hover:text-foreground"
          >
            Project Intakes
          </Link>
          <Link
            to="/portal/setup"
            activeProps={{ className: "border-primary text-foreground font-medium" }}
            className="border-b-2 border-transparent py-3 text-muted-foreground hover:text-foreground"
          >
            Setup
          </Link>

          <Link
            to="/portal/team"
            activeProps={{ className: "border-primary text-foreground font-medium" }}
            className="border-b-2 border-transparent py-3 text-muted-foreground hover:text-foreground"
          >
            Team
          </Link>

          <Link
            to="/portal/settings"
            activeProps={{ className: "border-primary text-foreground font-medium" }}
            className="border-b-2 border-transparent py-3 text-muted-foreground hover:text-foreground"
          >
            Settings
          </Link>

          {!isInternalSales && (
            <Link
              to="/portal/billing"
              activeProps={{ className: "border-primary text-foreground font-medium" }}
              className="border-b-2 border-transparent py-3 text-muted-foreground hover:text-foreground"
            >
              Billing
            </Link>
          )}
        </div>
      </nav>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
