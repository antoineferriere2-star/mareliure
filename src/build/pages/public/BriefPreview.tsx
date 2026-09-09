import { ShieldCheck } from "lucide-react";
import type { BriefLine, ProjectBrief } from "@/build/schema/brief";
import {
  BRIEF_SOURCE_LABELS,
  CONFIDENCE_LABEL_TEXT,
  CONFIDENCE_STYLE,
  computeCompletionPercent,
  computeItemsToVerify,
} from "@/build/schema/briefLabels";
import { publicCopy, usePublicLocale } from "@/build/pages/public/publicLocaleContext";

const SECTION_TITLES: Record<
  Exclude<
    keyof ProjectBrief,
    | "generatedAt"
    | "missionName"
    | "status"
    | "projectSummary"
    // Le résumé découpé accompagne `projectSummary` ; ce n'est pas une section
    // du Dossier et il n'a pas de titre à porter.
    | "projectSummaryParts"
    | "confidence"
    | "suggestedNextAction"
  >,
  string
> = {
  confirmedInformation: "Confirmed information",
  assumptionsAndCalculated: "Assumptions & calculated information",
  constraints: "Constraints",
  missingInformation: "Missing information",
  budgetAndTiming: "Budget and timing",
};

export function BriefPreview({
  brief,
  compact = false,
}: {
  brief: ProjectBrief;
  compact?: boolean;
}) {
  const { locale } = usePublicLocale();
  const copy = (text: string) => publicCopy(locale, text);
  const sections = Object.entries(SECTION_TITLES) as [keyof typeof SECTION_TITLES, string][];
  const completionPercent = computeCompletionPercent(brief);
  const itemsToVerify = computeItemsToVerify(brief);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
            {brief.status}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-normal">{copy("Project Brief")}</h2>
          <p className="mt-2 text-sm text-slate-500">
            {copy("Mission")}: {copy(brief.missionName)} ·{" "}
            {new Date(brief.generatedAt).toLocaleDateString(locale)}
          </p>
        </div>
        <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-700" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 font-semibold text-slate-700">
          {copy("Completion")}: {completionPercent}%
        </span>
        <span
          className={`rounded-full border px-3 py-1 font-semibold ${CONFIDENCE_STYLE[brief.confidence.label]}`}
        >
          {copy("Qualification confidence")}: {copy(CONFIDENCE_LABEL_TEXT[brief.confidence.label])}
        </span>
        <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 font-semibold text-amber-800">
          {itemsToVerify} {copy(itemsToVerify === 1 ? "item to verify" : "items to verify")}
        </span>
      </div>
      <p className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
        {copy(brief.projectSummary)}
      </p>
      <div className={`mt-5 grid gap-4 ${compact ? "" : "md:grid-cols-2 md:items-start"}`}>
        {sections.map(([key, title]) => (
          <BriefGroup key={key} title={copy(title)} lines={brief[key]} />
        ))}
      </div>
      <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm font-semibold text-emerald-950">
          {copy(brief.suggestedNextAction.label)}
        </p>
        <p className="mt-1 text-sm text-emerald-900">{copy(brief.suggestedNextAction.value)}</p>
        <p className="mt-2 text-xs uppercase tracking-[0.12em] text-emerald-700">
          {copy("Source")}: {copy(BRIEF_SOURCE_LABELS[brief.suggestedNextAction.source])}
        </p>
      </div>
    </article>
  );
}

/**
 * Condensed Brief card for side-by-side comparisons (e.g. before/after a
 * generic contact form) where the full multi-section BriefPreview would
 * dwarf the other column. Shows a handful of real confirmed facts — never
 * a hand-written summary — plus the same Completion/Confidence/Items-to-
 * verify indicators, with a link to the full brief for anyone who wants it.
 */
export function CompactBriefCard({ brief }: { brief: ProjectBrief }) {
  const { locale } = usePublicLocale();
  const copy = (text: string) => publicCopy(locale, text);
  const completionPercent = computeCompletionPercent(brief);
  const itemsToVerify = computeItemsToVerify(brief);
  const keyLines = [
    ...brief.confirmedInformation.slice(0, 3),
    ...brief.budgetAndTiming.slice(0, 1),
  ];

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
            {copy("Project Brief")}
          </p>
          <h3 className="mt-1 text-lg font-semibold tracking-normal text-slate-950">
            {copy(brief.missionName)}
          </h3>
        </div>
        <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-700" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        <span
          className={`rounded-full border px-2.5 py-0.5 font-semibold ${CONFIDENCE_STYLE[brief.confidence.label]}`}
        >
          {copy(CONFIDENCE_LABEL_TEXT[brief.confidence.label])} {copy("confidence")}
        </span>
        <span className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-0.5 font-semibold text-slate-700">
          {completionPercent}% {copy("complete")}
        </span>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-700">{copy(brief.projectSummary)}</p>
      <dl className="mt-4 space-y-2">
        {keyLines.map((line) => (
          <div key={`${line.label}-${line.value}`} className="text-sm">
            <dt className="inline font-medium text-slate-950">{copy(line.label)}: </dt>
            <dd className="inline text-slate-700">{copy(line.value)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
        {itemsToVerify} {copy(itemsToVerify === 1 ? "item to verify" : "items to verify")}{" "}
        {copy("before the first call — nothing here is a final quote.")}
      </p>
      <a
        href="/example-project-brief"
        className="mt-4 inline-block text-xs font-medium text-emerald-700 hover:underline"
      >
        {copy("View the full example brief →")}
      </a>
    </article>
  );
}

function BriefGroup({ title, lines }: { title: string; lines: BriefLine[] }) {
  const { locale } = usePublicLocale();
  const copy = (text: string) => publicCopy(locale, text);
  const byCategory = new Map<string | undefined, BriefLine[]>();
  for (const line of lines) {
    const key = line.category;
    byCategory.set(key, [...(byCategory.get(key) ?? []), line]);
  }

  return (
    <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      {lines.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{copy("None provided.")}</p>
      ) : (
        <div className="mt-3 space-y-4">
          {Array.from(byCategory.entries()).map(([category, categoryLines]) => (
            <div key={category ?? "_"}>
              {category && (
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.1em] text-slate-600">
                  {copy(category)}
                </p>
              )}
              <div className="space-y-2">
                {categoryLines.map((line) => (
                  <div key={`${line.label}-${line.value}`} className="text-sm leading-6">
                    <span className="font-medium text-slate-950">{copy(line.label)}: </span>
                    <span className="text-slate-700">{copy(line.value)}</span>
                    <span className="mt-1 block text-xs uppercase tracking-[0.12em] text-slate-600">
                      {copy(BRIEF_SOURCE_LABELS[line.source])}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
