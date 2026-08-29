import { ArrowRight, FileText } from "lucide-react";
import type { ProjectBrief } from "@/build/schema/brief";
import {
  BRIEF_SOURCE_LABELS,
  CONFIDENCE_LABEL_TEXT,
  pickOneLinePerSource,
} from "@/build/schema/briefLabels";
import { publicCopy, usePublicLocale } from "@/build/pages/public/publicLocaleContext";
import { ProjectCanvas } from "@/build/pages/public/ProjectCanvas";
import type { ProjectCanvasItem } from "@/build/pages/public/ProjectCanvasProjection";

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
  const demoCanvasItems: ProjectCanvasItem[] = [
    {
      id: "project",
      group: copy("Project"),
      label: copy("Project"),
      value: copy("Deck replacement"),
      status: "confirmed",
    },
    {
      id: "material",
      group: copy("Project"),
      label: copy("Material"),
      value: copy("Composite"),
      status: "approximate",
    },
    {
      id: "size",
      group: copy("To clarify"),
      label: copy("Size"),
      value: copy("To clarify"),
      status: "clarify",
    },
    {
      id: "existing",
      group: copy("Existing site"),
      label: copy("Existing site"),
      value: copy("Existing deck"),
      status: "confirmed",
    },
  ];

  return (
    <figure className="m-0">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_auto_minmax(0,1.15fr)] lg:items-center">
        <div className="rounded-lg border border-stone-300 bg-[#fffdf8] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
            {copy("Vague inquiry")}
          </p>
          <blockquote className="mt-4 text-xl font-medium leading-8 text-stone-950">
            “
            {copy(
              "I'd like to replace the old deck behind our house. Maybe composite. Not sure about the size.",
            )}
            ”
          </blockquote>
        </div>

        <div className="flex items-center justify-center">
          <span className="grid h-10 w-10 place-items-center rounded-full border border-stone-300 bg-white text-[color:var(--metre-accent)] shadow-sm">
            <ArrowRight className="h-4 w-4 rotate-90 lg:rotate-0" aria-hidden="true" />
          </span>
        </div>

        <div>
          <ProjectCanvas
            title={copy("Project Canvas")}
            eyebrow="Métré"
            items={demoCanvasItems}
            emptyText={copy("Your project will take shape as you answer.")}
          />
          <div className="mt-4 border-t border-stone-300 pt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                {copy("Sales action")}
              </p>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-800 whitespace-nowrap">
                {copy("Confidence")}: {copy(CONFIDENCE_LABEL_TEXT[brief.confidence.label])}
              </span>
            </div>
            <dl className="mt-3 grid gap-2">
              {heroLines.slice(0, 3).map((line) => (
                <div
                  key={`${line.label}-${line.value}`}
                  className="grid gap-1 sm:grid-cols-[1fr_auto]"
                >
                  <dt className="text-sm font-semibold text-stone-950">{copy(line.label)}</dt>
                  <dd className="text-sm text-stone-600">
                    {copy(BRIEF_SOURCE_LABELS[line.source])}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
      <figcaption className="mt-4 text-[13px] font-medium text-stone-600">
        {copy("One guided Mission in, one structured Project Brief out.")}
      </figcaption>
    </figure>
  );
}
