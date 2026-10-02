import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { isHydrated, navigateBeforeHydration } from "@/lib/hydration";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      // Avant l'hydratation, une redirection du routeur provoquerait React #418 (voir lib/hydration.ts).
      if (!isHydrated()) return navigateBeforeHydration(`/auth?redirect=${encodeURIComponent(location.pathname)}`);
      throw redirect({ to: "/auth", search: { redirect: location.pathname } });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
