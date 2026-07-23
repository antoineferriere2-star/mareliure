import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/build/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin — Métré Build AI" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: BuildAdminHome,
});

function BuildAdminHome() {
  const { admin } = Route.useRouteContext();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Espace admin Build</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connecté en tant que {admin.email ?? admin.userId}. Cet espace est réservé aux admins.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground">Modules disponibles</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Les écrans admin (missions, dossiers, demandes publiques) seront ajoutés ici.
        </p>
      </div>
    </div>
  );
}
