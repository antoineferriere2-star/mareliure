import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { isHydrated, navigateBeforeHydration } from "@/lib/hydration";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // Import à la demande : `beforeLoad` reste dans le paquet principal, chargé
    // par toutes les pages, y compris publiques. Importé en tête de fichier, le
    // client Supabase (≈ 150 Ko) pesait sur chaque visite de l'accueil.
    const { supabase } = await import("@/integrations/supabase/client");
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
