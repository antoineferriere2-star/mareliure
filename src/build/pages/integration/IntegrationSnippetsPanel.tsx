import { useMemo, useState } from "react";
import { buildIntegrationSnippets } from "@/build/intakes/integrationSnippets";
import { intakeAccessibleTitle } from "@/build/intakes/intakeTitle";

type SnippetKey = "linkHtml" | "buttonHtml" | "iframeHtml";

const SNIPPET_LABELS: Record<SnippetKey, string> = {
  linkHtml: "HTML link",
  buttonHtml: "Button HTML",
  iframeHtml: "Responsive iframe",
};

export function IntegrationSnippetsPanel({
  publicUrl,
  ctaLabel = "Start your project",
  missionName,
  brandColor,
}: {
  publicUrl: string;
  ctaLabel?: string;
  /** The customer's accent. Omitted, the button keeps the product's own green.
   * The generator has accepted this since it was written; nothing passed it,
   * so every customer pasted a Métré-green button onto their own site. */
  brandColor?: string;
  /** Raw commercial name. The embed's accessible title is derived from it
   * here, so every caller gets the same wording (see intakeAccessibleTitle). */
  missionName?: string;
}) {
  const [copied, setCopied] = useState<"url" | SnippetKey | null>(null);
  const snippets = useMemo(
    () =>
      buildIntegrationSnippets({
        publicUrl,
        ctaLabel,
        iframeTitle: intakeAccessibleTitle(missionName),
        brandColor,
        origin: typeof window !== "undefined" ? window.location.origin : "https://metre-pro.com",
      }),
    [brandColor, ctaLabel, missionName, publicUrl],
  );

  async function copy(text: string, key: "url" | SnippetKey) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // The fields remain selectable if clipboard access is blocked.
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-foreground">Direct link</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={snippets.publicUrl}
            className="w-full flex-1 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-foreground"
          />
          <button
            type="button"
            onClick={() => copy(snippets.publicUrl, "url")}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            {copied === "url" ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {(Object.keys(SNIPPET_LABELS) as SnippetKey[]).map((key) => (
        <div key={key}>
          <label className="mb-1 block text-xs font-medium text-foreground">
            {SNIPPET_LABELS[key]}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <textarea
              readOnly
              rows={key === "iframeHtml" ? 6 : 3}
              value={snippets[key]}
              className="w-full flex-1 rounded-md border border-input bg-muted/40 px-3 py-2 font-mono text-xs text-foreground"
            />
            <button
              type="button"
              onClick={() => copy(snippets[key], key)}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              {copied === key ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
