import { ArrowRight, Check, FileText, Sparkles } from "lucide-react";
import type { ProjectBrief } from "@/build/schema/brief";
import { deckPlaybookSchema } from "@/build/playbooks/deckPlaybookSchema";

const missionSteps = deckPlaybookSchema.sections
  .flatMap((section) => section.steps)
  .slice(0, 4)
  .map((step) => step.title);

/**
 * Compact, horizontal hero product shot. Shows the Mission → Project Brief
 * transformation at a glance: 4 Mission steps on the left, 5 Project Brief
 * blocks on the right. Secondary details are intentionally hidden — the full
 * brief lives further down the page.
 */
export function HeroTransformShot({ brief }: { brief: ProjectBrief }) {
  const briefBlocks = [
    { label: "Project summary", value: brief.projectSummary },
    ...brief.confirmedInformation.slice(0, 2).map((line) => ({
      label: line.label,
      value: line.value,
    })),
    brief.budgetAndTiming[0]
      ? { label: brief.budgetAndTiming[0].label, value: brief.budgetAndTiming[0].value }
      : null,
    brief.missingInformation[0]
      ? { label: "Missing", value: brief.missingInformation[0].label }
      : null,
  ]
    .filter((block): block is { label: string; value: string } => Boolean(block))
    .slice(0, 5);

  return (
    <figure className="m-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.1fr)]">
        {/* MISSION */}
        <div className="p-5">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
            Project Mission
          </p>
          <ol className="mt-4 space-y-2">
            {missionSteps.map((title, index) => (
              <li
                key={title}
                className={`flex items-center gap-3 rounded-md border p-2.5 text-[14px] leading-5 ${
                  index === 1
                    ? "border-emerald-300 bg-emerald-50 font-medium text-emerald-950"
                    : "border-slate-200 bg-slate-50 text-slate-700"
                }`}
              >
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold ${
                    index === 0
                      ? "bg-emerald-600 text-white"
                      : index === 1
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {index === 0 ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
                </span>
                <span className="min-w-0 truncate">{title}</span>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            {["Guided", "\u201CNot sure\u201D allowed", "Photos"].map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-medium text-slate-600"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>

        {/* ARROW */}
        <div className="flex items-center justify-center border-slate-200 bg-slate-50 px-4 py-3 md:border-x md:py-0">
          <span className="grid h-9 w-9 place-items-center rounded-full border border-emerald-200 bg-white text-emerald-700 shadow-sm">
            <ArrowRight className="h-4 w-4 rotate-90 md:rotate-0" aria-hidden="true" />
          </span>
        </div>

        {/* BRIEF */}
        <div className="border-t border-slate-200 bg-white p-5 md:border-t-0">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
              <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
              Project Brief
            </p>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-800">
              Confidence: {brief.confidence.label}
            </span>
          </div>
          <dl className="mt-4 space-y-2">
            {briefBlocks.map((block) => (
              <div key={block.label} className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {block.label}
                </dt>
                <dd className="mt-0.5 line-clamp-2 text-[14px] leading-5 text-slate-800">
                  {block.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <figcaption className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-[13px] font-medium text-slate-600">
        One guided Mission in, one structured Project Brief out.
      </figcaption>
    </figure>
  );
}
