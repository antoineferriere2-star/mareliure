export function UrlStep({
  url,
  onUrlChange,
  onAnalyze,
  analyzing,
  error,
}: {
  url: string;
  onUrlChange: (value: string) => void;
  onAnalyze: () => void;
  analyzing: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Client website URL</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste the client's public website address. We analyze its content to suggest a business type and
          products — nothing is ever invented beyond what the site states.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !analyzing) onAnalyze();
          }}
          placeholder="https://example.com"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={onAnalyze}
          disabled={analyzing || url.trim().length === 0}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {analyzing ? "Analyzing…" : "Analyze"}
        </button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
