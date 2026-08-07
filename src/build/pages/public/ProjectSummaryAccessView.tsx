// Fetches a visitor's Project Summary via the secure, single-purpose
// /api/public/project-summary endpoint (src/routes/api/public/project-summary.ts)
// and renders it through the same VisitorProjectSummaryView used on the live
// post-submission screen. Read-only: no session, no mutation, no dossier id
// ever touches the client.
import { useEffect, useState } from "react";
import type { DisplayPhotoReference, VisitorProjectSummary } from "@/build/schema/visitorSummary";

/** The public endpoint's response shape: identical to VisitorProjectSummary except photos never carry a storage path — only a resolved signed url + caption. */
type PublicVisitorProjectSummary = Omit<VisitorProjectSummary, "photos"> & {
  photos: DisplayPhotoReference[];
};
import { VisitorProjectSummaryView } from "./VisitorProjectSummaryView";
import { BuildPublicShell } from "./BuildPublicShell";
import { publicCopy, usePublicLocale } from "./publicLocaleContext";

export function ProjectSummaryAccessView({ accessToken }: { accessToken: string }) {
  const [businessName, setBusinessName] = useState<string | null>(null);
  return (
    // No FAQ launcher on the secure summary page either — same reasoning
    // as MissionRuntime: this is the visitor's own submitted result, not a
    // place to surface a generic assistant entry point.
    //
    // Embedded chrome for the same reason too: whoever opens this link is the
    // business's customer reading their own summary, not a Métré Build
    // prospect who should be shown pricing.
    <BuildPublicShell showFaqLauncher={false} chrome="embedded" businessName={businessName}>
      <ProjectSummaryAccessContent accessToken={accessToken} onBusinessName={setBusinessName} />
    </BuildPublicShell>
  );
}

function ProjectSummaryAccessContent({
  accessToken,
  onBusinessName,
}: {
  accessToken: string;
  onBusinessName: (name: string | null) => void;
}) {
  const { locale } = usePublicLocale();
  const copy = (text: string) => publicCopy(locale, text);
  const [summary, setSummary] = useState<PublicVisitorProjectSummary | null>(null);
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
        const data = (await res.json()) as { summary: PublicVisitorProjectSummary };
        setSummary(data.summary);
        onBusinessName(data.summary.businessName ?? null);
      } catch {
        if (!cancelled) setNotAvailable(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Stable setState setter — listing it does not re-trigger the fetch.
  }, [accessToken, onBusinessName]);

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
