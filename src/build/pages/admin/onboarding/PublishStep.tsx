import { useState } from "react";

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
  const [copied, setCopied] = useState<"link" | "snippet" | null>(null);
  const snippet = publicUrl
    ? `<iframe src="${publicUrl}" style="width:100%;min-height:900px;border:0;" title="${missionName}"></iframe>`
    : null;

  function copy(text: string, kind: "link" | "snippet") {
    navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  }

  if (publicUrl) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">Mission publiée</p>
          <p className="mt-1 text-sm text-emerald-800">{missionName}</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground">Lien public</label>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row">
            <code className="flex-1 truncate rounded bg-muted px-3 py-2 text-xs">{publicUrl}</code>
            <button
              type="button"
              onClick={() => copy(publicUrl, "link")}
              className="rounded-md border border-input bg-background px-3 py-2 text-xs hover:bg-accent"
            >
              {copied === "link" ? "Copié !" : "Copier le lien"}
            </button>
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-input bg-background px-3 py-2 text-xs hover:bg-accent"
            >
              Ouvrir
            </a>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground">Snippet à intégrer sur le site du client</label>
          <textarea
            readOnly
            value={snippet ?? ""}
            rows={3}
            className="mt-1 w-full rounded-md border border-input bg-muted px-3 py-2 font-mono text-xs"
          />
          <button
            type="button"
            onClick={() => snippet && copy(snippet, "snippet")}
            className="mt-2 rounded-md border border-input bg-background px-3 py-2 text-xs hover:bg-accent"
          >
            {copied === "snippet" ? "Copié !" : "Copier le snippet"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Publier</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Mission « {missionName} » basée sur le Playbook « {playbookName} ». Une fois publiée, le lien public est
          immédiatement actif.
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
          {publishing ? "Publication…" : "Publier"}
        </button>
      </div>
    </div>
  );
}
