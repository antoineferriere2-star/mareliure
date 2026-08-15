// A published demo's public URL, shown as selectable text next to the copy
// button.
//
// The copy button alone was enough for a person and useless to everyone else:
// `navigator.clipboard` needs a focused document and a permission, and it fails
// silently in an embedded or automated browser — leaving the one thing the
// screen exists to produce unreachable. The address is now always readable and
// selectable, and copying is the shortcut rather than the only route.
import { useState } from "react";

/** Absolute URL, built in the browser: server code has no reliable origin. */
function absolute(path: string): string {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

export function DemoLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const href = absolute(path);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        readOnly
        value={href}
        aria-label="Public demo link"
        onFocus={(event) => event.currentTarget.select()}
        className="min-w-0 flex-1 rounded-md border border-input bg-muted/40 px-2 py-1 font-mono text-xs text-foreground"
      />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(href);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          } catch {
            // Clipboard blocked. The address is visible and selectable right
            // beside this button, so there is nothing to report.
            setCopied(false);
          }
        }}
        className="shrink-0 rounded-md border border-input bg-background px-2 py-1 text-xs font-medium hover:bg-accent"
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <a
        href={path}
        target="_blank"
        rel="noreferrer noopener"
        className="shrink-0 rounded-md border border-input bg-background px-2 py-1 text-xs font-medium hover:bg-accent"
      >
        Open
      </a>
    </div>
  );
}
