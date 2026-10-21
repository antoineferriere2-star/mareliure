// Loading skeleton for the public Guided Project Intake (/m/:publicToken).
// Reserves the approximate height of the real step card so the page never
// collapses to a single line of text nor reflows once the real content
// mounts — see MissionRuntime.tsx for how `loading`/`slowLoad` drive this.
export function MissionRuntimeSkeleton({ label }: { label: string }) {
  return (
    <section
      aria-busy="true"
      aria-label={label}
      className="mx-auto max-w-5xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
    >
      <div className="border-b border-slate-200 p-6">
        <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 h-8 w-2/3 animate-pulse rounded bg-slate-200" />
        <div className="mt-5 h-2 w-full animate-pulse rounded-full bg-slate-100" />
      </div>
      <div className="grid gap-4 p-6">
        <div className="h-24 animate-pulse rounded-md bg-slate-100" />
        <div className="h-24 animate-pulse rounded-md bg-slate-100" />
      </div>
    </section>
  );
}

/**
 * Ce que le serveur envoie pour une route de Mission (`ssr: false`) : TanStack rend le
 * `pendingComponent` à la place de la page. Sans lui, le HTML reçu n'avait pas de corps et le
 * visiteur voyait un écran vide jusqu'au chargement du JavaScript. Même squelette, même
 * surface que l'état de chargement du runtime : rien ne saute quand la Mission prend la main.
 */
export function MissionRuntimePending({ label }: { label: string }) {
  return (
    <main className="intake-surface min-h-screen px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-5xl">
        <MissionRuntimeSkeleton label={label} />
      </div>
    </main>
  );
}
