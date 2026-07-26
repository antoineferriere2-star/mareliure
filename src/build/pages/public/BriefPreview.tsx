import { ShieldCheck } from "lucide-react";
import type { BriefLine, ProjectBrief } from "@/build/schema/brief";
import {
  BRIEF_SOURCE_LABELS,
  computeCompletionPercent,
  computeItemsToVerify,
} from "@/build/schema/briefLabels";

const SECTION_TITLES: Record<
  Exclude<
    keyof ProjectBrief,
    | "generatedAt"
    | "missionName"
    | "status"
    | "projectSummary"
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

const CONFIDENCE_STYLE: Record<ProjectBrief["confidence"]["label"], string> = {
  high: "border-emerald-300 bg-emerald-50 text-emerald-800",
  medium: "border-amber-300 bg-amber-50 text-amber-800",
  low: "border-rose-300 bg-rose-50 text-rose-800",
};

const CONFIDENCE_LABEL_TEXT: Record<ProjectBrief["confidence"]["label"], string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function BriefPreview({
  brief,
  compact = false,
}: {
  brief: ProjectBrief;
  compact?: boolean;
}) {
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
          <h2 className="mt-2 text-2xl font-semibold tracking-normal">Project Brief</h2>
          <p className="mt-2 text-sm text-slate-500">
            Mission: {brief.missionName} · {new Date(brief.generatedAt).toLocaleDateString("en-US")}
          </p>
        </div>
        <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-700" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 font-semibold text-slate-700">
          Completion: {completionPercent}%
        </span>
        <span
          className={`rounded-full border px-3 py-1 font-semibold ${CONFIDENCE_STYLE[brief.confidence.label]}`}
        >
          Qualification confidence: {CONFIDENCE_LABEL_TEXT[brief.confidence.label]}
        </span>
        <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 font-semibold text-amber-800">
          {itemsToVerify} item{itemsToVerify === 1 ? "" : "s"} to verify
        </span>
      </div>
      <p className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
        {brief.projectSummary}
      </p>
      <div className={`mt-5 grid gap-4 ${compact ? "" : "md:grid-cols-2"}`}>
        {sections.map(([key, title]) => (
          <BriefGroup key={key} title={title} lines={brief[key]} />
        ))}
      </div>
      <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm font-semibold text-emerald-950">{brief.suggestedNextAction.label}</p>
        <p className="mt-1 text-sm text-emerald-900">{brief.suggestedNextAction.value}</p>
        <p className="mt-2 text-xs uppercase tracking-[0.12em] text-emerald-700">
          Source: {BRIEF_SOURCE_LABELS[brief.suggestedNextAction.source]}
        </p>
      </div>
    </article>
  );
}

function BriefGroup({ title, lines }: { title: string; lines: BriefLine[] }) {
  const byCategory = new Map<string | undefined, BriefLine[]>();
  for (const line of lines) {
    const key = line.category;
    byCategory.set(key, [...(byCategory.get(key) ?? []), line]);
  }

  return (
    <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      {lines.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">None provided.</p>
      ) : (
        <div className="mt-3 space-y-4">
          {Array.from(byCategory.entries()).map(([category, categoryLines]) => (
            <div key={category ?? "_"}>
              {category && (
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.1em] text-slate-600">
                  {category}
                </p>
              )}
              <div className="space-y-2">
                {categoryLines.map((line) => (
                  <div key={`${line.label}-${line.value}`} className="text-sm leading-6">
                    <span className="font-medium text-slate-950">{line.label}: </span>
                    <span className="text-slate-700">{line.value}</span>
                    <span className="mt-1 block text-xs uppercase tracking-[0.12em] text-slate-600">
                      {BRIEF_SOURCE_LABELS[line.source]}
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
