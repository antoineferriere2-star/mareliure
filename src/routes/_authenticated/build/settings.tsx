import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/build/settings")({
  ssr: false,
  head: () => ({ meta: [{ title: "Settings — Métré Build AI" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { admin } = Route.useRouteContext();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Réglages du workspace Métré Build AI.</p>
      </header>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">Compte</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Email admin</dt>
            <dd className="mt-0.5 text-foreground">{admin.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">User ID</dt>
            <dd className="mt-0.5 font-mono text-xs">{admin.userId}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">Workspace</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Nom</dt>
            <dd className="mt-0.5 text-foreground">Métré Build AI</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Mode</dt>
            <dd className="mt-0.5">
              <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                Dev · Private beta
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">URL publique</dt>
            <dd className="mt-0.5">
              <a href="https://metre-pro.com" target="_blank" rel="noreferrer" className="text-primary underline">
                https://metre-pro.com
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Espace admin</dt>
            <dd className="mt-0.5 text-foreground">/build/* — privé, admin uniquement</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">Runtime public</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Les visiteurs accèdent uniquement à <code className="rounded bg-muted px-1">/m/:publicToken</code>,
          généré à la publication d'une mission. Aucune autre route Build n'est exposée aux anonymes.
        </p>
      </section>

      <section className="rounded-lg border border-dashed border-border bg-card p-5 text-xs text-muted-foreground">
        Membres admin supplémentaires, marque, domaine personnalisé — bientôt.
      </section>
    </div>
  );
}
