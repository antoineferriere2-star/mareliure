// Visitor-facing Project Summary screen — deliberately distinct from
// BriefPreview (the internal commercial Project Brief view). Renders a
// VisitorProjectSummary DTO (src/build/schema/visitorSummary.ts), never the
// raw ProjectBrief. Shared between the live post-submission screen
// (MissionRuntime) and the secure /project-summary/:accessToken page (Lot 4).
import type { VisitorProjectSummary } from "@/build/schema/visitorSummary";
import { publicCopy, usePublicLocale } from "./publicLocaleContext";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ItemList({ items }: { items: { label: string; value: string }[] }) {
  return (
    <ul className="space-y-1.5 text-sm text-slate-700">
      {items.map((item) => (
        <li key={`${item.label}|${item.value}`}>
          <span className="font-medium text-slate-900">{item.label}:</span> {item.value}
        </li>
      ))}
    </ul>
  );
}

export function VisitorProjectSummaryView({
  summary,
  emailSent,
}: {
  summary: VisitorProjectSummary;
  emailSent?: boolean;
}) {
  const { locale } = usePublicLocale();
  const copy = (text: string) => publicCopy(locale, text);

  const projectItems = [
    ...summary.confirmedItems,
    ...summary.calculatedItems,
    ...summary.budgetAndTimingItems,
  ];

  const whatsNext =
    summary.confirmationText ??
    copy("The team will review your project information and contact you to discuss the next step.");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Bloc 1 — Confirmation */}
      <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
        <h1 className="text-2xl font-semibold text-emerald-900">
          {copy("Your project summary is ready")}
        </h1>
        <p className="mt-2 text-sm text-emerald-900/80">
          {copy("Your information has been sent to")} {summary.businessName}.
        </p>
      </section>

      {/* Bloc 2 — Project Summary */}
      <Section title={copy("Project summary")}>
        {summary.summary && <p className="mb-3 text-sm text-slate-700">{summary.summary}</p>}
        {projectItems.length > 0 ? (
          <ItemList items={projectItems} />
        ) : (
          <p className="text-sm text-slate-500">{copy("No details were provided yet.")}</p>
        )}
        {summary.photos.length > 0 && (
          <p className="mt-3 text-sm text-slate-500">
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
        <p className="text-sm text-slate-700">{whatsNext}</p>
      </Section>

      {/* Bloc 5 — Email confirmation, only shown if the send actually succeeded */}
      {emailSent && (
        <p className="text-center text-sm text-slate-500">
          {copy("We sent a copy of this summary to your email.")}
        </p>
      )}
    </div>
  );
}
