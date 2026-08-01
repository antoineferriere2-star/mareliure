import { ArrowRight, Check, FileText, Sparkles } from "lucide-react";
import type { ProjectBrief } from "@/build/schema/brief";
import { deckPlaybookSchema } from "@/build/playbooks/deckPlaybookSchema";
import {
  BRIEF_SOURCE_LABELS,
  CONFIDENCE_LABEL_TEXT,
  pickOneLinePerSource,
} from "@/build/schema/briefLabels";
import { publicCopy, usePublicLocale } from "@/build/pages/public/publicLocaleContext";

const missionSteps = deckPlaybookSchema.sections
  .flatMap((section) => section.steps)
  .slice(0, 3)
  .map((step) => step.title);

/**
 * Compact, horizontal hero product shot. Shows the Mission → Project Brief
 * transformation at a glance: a handful of Mission steps on the left, up to
 * 4 annotated Project Brief lines (one per source type) on the right, which
 * is the product's actual differentiator. The full brief lives further down
 * the page.
 */
export function HeroTransformShot({ brief }: { brief: ProjectBrief }) {
  const { locale } = usePublicLocale();
  const copy = (text: string) => publicCopy(locale, text);
  const heroLines = pickOneLinePerSource(brief);

  return (
    <figure className="m-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-0 md:grid-cols-[minmax(0,0.8fr)_auto_minmax(0,1.3fr)]">
        {/* MISSION */}
        <div className="bg-slate-50 p-5">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
            {copy("Guided Project Intake")}
          </p>
          <ol className="mt-4 space-y-2">
            {missionSteps.map((title, index) => (
              <li
                key={title}
                className={`flex items-center gap-3 rounded-md border p-2.5 text-[14px] leading-5 ${
                  index === 1
                    ? "border-emerald-300 bg-emerald-50 font-medium text-emerald-950"
                    : "border-slate-200 bg-white text-slate-700"
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
                <span className="min-w-0 line-clamp-2">{copy(title)}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* ARROW */}
        <div className="flex items-center justify-center border-slate-200 bg-slate-50 px-4 py-3 md:border-x md:py-0">
          <span className="grid h-9 w-9 place-items-center rounded-full border border-emerald-200 bg-white text-emerald-700 shadow-sm">
            <ArrowRight className="h-4 w-4 rotate-90 md:rotate-0" aria-hidden="true" />
          </span>
        </div>

        {/* BRIEF */}
        <div className="border-t border-slate-200 bg-white p-6 md:border-t-0">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
              <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
              {copy("Project Brief")}
            </p>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-800 whitespace-nowrap">
              {copy("Confidence")}: {copy(CONFIDENCE_LABEL_TEXT[brief.confidence.label])}
            </span>
          </div>
          <dl className="mt-4 space-y-3">
            {heroLines.map((line) => (
              <div
                key={`${line.label}-${line.value}`}
                className="rounded-md border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-[13px] font-semibold text-slate-950">{copy(line.label)}</dt>
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                    {copy(BRIEF_SOURCE_LABELS[line.source])}
                  </span>
                </div>
                <dd className="mt-1 line-clamp-2 text-[14px] leading-5 text-slate-700">
                  {copy(line.value)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <figcaption className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-[13px] font-medium text-slate-600">
        {copy("One guided Mission in, one structured Project Brief out.")}
      </figcaption>
    </figure>
  );
}
