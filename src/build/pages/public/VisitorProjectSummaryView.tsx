// Visitor-facing Project Summary screen — deliberately distinct from
// BriefPreview (the internal commercial Project Brief view). Renders a
// VisitorProjectSummary DTO (src/build/schema/visitorSummary.ts), never the
// raw ProjectBrief. Shared between the live post-submission screen
// (MissionRuntime) and the secure /project-summary/:accessToken page (Lot 4).
import { lazy, Suspense } from "react";
import type { DisplayPhotoReference, VisitorProjectSummary } from "@/build/schema/visitorSummary";
import { DeckPreviewErrorBoundary } from "@/build/visualPreview/DeckPreviewErrorBoundary";
import { publicCopy, usePublicLocale } from "./publicLocaleContext";
import { ProjectCanvas } from "./ProjectCanvas";
import { projectCanvasItemsFromSummary } from "./ProjectCanvasProjection";

// Loaded dynamically, after the textual summary, so a Mission that never
// enables the visual-preview capability never pays for this bundle at all.
const DeckVisualPreview = lazy(() => import("@/build/visualPreview/DeckVisualPreview"));

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-stone-300 pt-5">
      <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-stone-500">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ItemList({ items }: { items: { label: string; value: string }[] }) {
  return (
    <ul className="space-y-1.5 text-sm text-stone-700">
      {items.map((item) => (
        <li key={`${item.label}|${item.value}`}>
          <span className="font-medium text-stone-950">{item.label}:</span> {item.value}
        </li>
      ))}
    </ul>
  );
}

export function VisitorProjectSummaryView({
  summary,
  emailSent,
  summaryUrl,
  onStartNew,
  followUp,
}: {
  summary: Omit<VisitorProjectSummary, "photos"> & { photos: DisplayPhotoReference[] };
  /**
   * What the deployment offers once the project is sent — on Ma Reliure, the
   * way into the customer space. Supplied by the route, never decided here:
   * this view renders a Mission, it does not know who runs it.
   */
  followUp?: React.ReactNode;
  emailSent?: boolean;
  /** Only passed on the live post-submission screen — the secure /project-summary page itself never links back to itself. */
  summaryUrl?: string | null;
  /**
   * Only passed by the live runtime. The secure /project-summary page is
   * reached from an email and has no intake session to restart.
   */
  onStartNew?: () => void;
}) {
  const { locale } = usePublicLocale();
  const copy = (text: string) => publicCopy(locale, text);

  const projectItems = [
    ...summary.confirmedItems,
    ...summary.calculatedItems,
    ...summary.budgetAndTimingItems,
  ];
  const canvasItems = projectCanvasItemsFromSummary(summary, copy);

  const whatsNext =
    summary.confirmationText ??
    copy("The team will review your project information and contact you to discuss the next step.");

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
      <div className="space-y-6 rounded-lg border border-stone-300 bg-white p-5 shadow-sm sm:p-6">
        {/* Bloc 1 — Confirmation */}
        <section>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-emerald-700">
            {copy("Project sent")}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-stone-950">
            {copy("Your project summary is ready")}
          </h1>
          <p className="mt-3 text-base leading-7 text-stone-600">
            {copy("Your information has been sent to")} {summary.businessName}.
          </p>
        </section>

        {/* Bloc 2 — Project Summary */}
        <Section title={copy("Project summary")}>
          {summary.summary && (
            <p className="mb-3 text-base leading-7 text-stone-700">{summary.summary}</p>
          )}
          {projectItems.length > 0 ? (
            <ItemList items={projectItems} />
          ) : (
            <p className="text-sm text-stone-500">{copy("No details were provided yet.")}</p>
          )}
          {summary.photos.length > 0 && (
            <p className="mt-3 text-sm text-stone-500">
              {summary.photos.length}{" "}
              {copy(summary.photos.length === 1 ? "photo attached" : "photos attached")}
            </p>
          )}
        </Section>

        {/* Bloc 3 — Still to confirm */}
        {summary.itemsToConfirm.length > 0 && (
          <Section title={copy("Still to confirm")}>
            <ItemList items={summary.itemsToConfirm} />
          </Section>
        )}

        {/* Bloc 4 — What happens next */}
        <Section title={copy("What happens next")}>
          <p className="text-base leading-7 text-stone-700">{whatsNext}</p>
        </Section>

        {/* Bloc 5 — Email confirmation, only shown if the send actually succeeded */}
        {emailSent && (
          <p className="text-center text-sm text-stone-500">
            {copy("We sent a copy of this summary to your email.")}
          </p>
        )}

        {/* Bloc 5b — What the deployment offers next (Ma Reliure: the customer space) */}
        {followUp}

        {/* Bloc 6 — Actions */}
        {summaryUrl && (
          <p className="text-center text-sm">
            <a href={summaryUrl} className="font-medium text-emerald-700 hover:underline">
              {copy("Review your summary")}
            </a>
          </p>
        )}

        {onStartNew && (
          <div className="border-t border-stone-200 pt-5 text-center">
            <button
              type="button"
              onClick={onStartNew}
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-900 transition-colors hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--metre-accent)] focus-visible:ring-offset-2"
            >
              {copy("Start another project")}
            </button>
          </div>
        )}

        {/* Bloc 7 — Deck visual preview: a secondary, illustrative enhancement
          that always renders after the textual summary above, and whose
          failure or absence never affects anything else on this page. */}
        {summary.visualPreview && (
          <DeckPreviewErrorBoundary fallbackMessage={copy("The visual preview couldn't be shown.")}>
            <Suspense fallback={null}>
              <DeckVisualPreview
                snapshot={summary.visualPreview}
                measurementSystem={summary.measurementSystem}
              />
            </Suspense>
          </DeckPreviewErrorBoundary>
        )}
      </div>
      <ProjectCanvas
        title={copy("Your project")}
        eyebrow={copy("Project canvas")}
        items={canvasItems}
        emptyText={copy("No details were provided yet.")}
        className="lg:sticky lg:top-6"
      />
    </div>
  );
}
