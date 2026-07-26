// Shared loading / error UI for every /portal/* route, so a slow or failing
// server function never leaves the Espace Client on a blank screen.
export function PortalPending() {
  return (
    <div className="space-y-3" aria-busy="true">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="h-24 w-full animate-pulse rounded-lg bg-muted" />
      <div className="h-24 w-full animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

export function PortalError({ error }: { error: Error }) {
  const message =
    error instanceof Error && error.message ? error.message : "Une erreur est survenue.";
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive"
    >
      <p className="font-medium">Impossible d'afficher cette page.</p>
      <p className="mt-1 text-xs">{message}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-3 rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground hover:bg-accent"
      >
        Réessayer
      </button>
    </div>
  );
}
