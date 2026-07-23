import { createFileRoute } from "@tanstack/react-router";
import { deckDemoSteps } from "@/build/services/deckProjectBrief";

export const Route = createFileRoute("/_authenticated/build/playbooks")({
  ssr: false,
  head: () => ({ meta: [{ title: "Playbooks — Métré Build AI" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: PlaybooksPage,
});

function PlaybooksPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Playbooks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Modèles de questions de qualification par type de projet. Les playbooks CRUD arrivent bientôt — voici les playbooks intégrés.
        </p>
      </header>

      <article className="rounded-lg border border-border bg-card p-5">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Terrasse / Deck — v1</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Playbook intégré · {deckDemoSteps.length} étapes · utilisé par la démo `/demo/deck-project`.
            </p>
          </div>
          <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase text-emerald-800">
            Built-in
          </span>
        </header>

        <ol className="mt-4 space-y-3">
          {deckDemoSteps.map((step, i) => (
            <li key={step.id} className="rounded-md border border-border/60 bg-background p-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <div>
                  <div className="text-sm font-medium text-foreground">{step.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">Pourquoi : {step.why}</div>
                  <div className="mt-1 text-[10px] font-mono uppercase text-muted-foreground">{step.id}</div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </article>

      <div className="rounded-lg border border-dashed border-border bg-card p-4 text-xs text-muted-foreground">
        Les playbooks personnalisés (CRUD, versionnage) arrivent bientôt.
      </div>
    </div>
  );
}
