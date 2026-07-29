// Fetches a visitor's Project Summary via the secure, single-purpose
// /api/public/project-summary endpoint (src/routes/api/public/project-summary.ts)
// and renders it through the same VisitorProjectSummaryView used on the live
// post-submission screen. Read-only: no session, no mutation, no dossier id
// ever touches the client.
import { useEffect, useState } from "react";
import type { VisitorProjectSummary } from "@/build/schema/visitorSummary";
import { VisitorProjectSummaryView } from "./VisitorProjectSummaryView";
import { BuildPublicShell } from "./BuildPublicShell";
import { publicCopy, usePublicLocale } from "./publicLocaleContext";

export function ProjectSummaryAccessView({ accessToken }: { accessToken: string }) {
  return (
    <BuildPublicShell>
      <ProjectSummaryAccessContent accessToken={accessToken} />
    </BuildPublicShell>
  );
}

function ProjectSummaryAccessContent({ accessToken }: { accessToken: string }) {
  const { locale } = usePublicLocale();
  const copy = (text: string) => publicCopy(locale, text);
  const [summary, setSummary] = useState<VisitorProjectSummary | null>(null);
  const [notAvailable, setNotAvailable] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/public/project-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: accessToken }),
        });
        if (cancelled) return;
        if (!res.ok) {
          setNotAvailable(true);
          return;
        }
        const data = (await res.json()) as { summary: VisitorProjectSummary };
        setSummary(data.summary);
      } catch {
        if (!cancelled) setNotAvailable(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  return (
    <main className="bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      {loading && <p className="mx-auto max-w-3xl text-slate-600">{copy("Loading…")}</p>}
      {!loading && notAvailable && (
        <div className="mx-auto max-w-3xl rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {copy("This summary link is not available.")}
        </div>
      )}
      {!loading && summary && <VisitorProjectSummaryView summary={summary} />}
    </main>
  );
}
