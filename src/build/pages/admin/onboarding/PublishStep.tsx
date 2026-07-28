import { IntegrationSnippetsPanel } from "@/build/pages/integration/IntegrationSnippetsPanel";

export function PublishStep({
  missionName,
  playbookName,
  publicUrl,
  publishing,
  error,
  onBack,
  onPublish,
}: {
  missionName: string;
  playbookName: string;
  publicUrl: string | null;
  publishing: boolean;
  error: string | null;
  onBack: () => void;
  onPublish: () => void;
}) {
  if (publicUrl) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">Mission publiée</p>
          <p className="mt-1 text-sm text-emerald-800">{missionName}</p>
        </div>

        <IntegrationSnippetsPanel
          publicUrl={publicUrl}
          ctaLabel="Start your project"
          iframeTitle={`${missionName} project intake`}
        />
        <a
          href={publicUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex rounded-md border border-input bg-background px-3 py-2 text-xs hover:bg-accent"
        >
          Open runtime
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Publish</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Mission « {missionName} » basée sur le Playbook « {playbookName} ». Une fois publiée, le
          lien public est immédiatement actif.
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={publishing}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
        >
          Retour
        </button>
        <button
          type="button"
          onClick={onPublish}
          disabled={publishing}
          className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
        >
          {publishing ? "Publishing..." : "Publish"}
        </button>
      </div>
    </div>
  );
}
