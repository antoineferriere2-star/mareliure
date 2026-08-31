import { ArrowRight } from "lucide-react";
import type { ProjectBrief } from "@/build/schema/brief";
import { publicCopy, usePublicLocale } from "@/build/pages/public/publicLocaleContext";
import { ProjectCanvas } from "@/build/pages/public/ProjectCanvas";
import type { ProjectCanvasItem } from "@/build/pages/public/ProjectCanvasProjection";

/**
 * Large hero product shot: one vague customer inquiry becomes a readable
 * Project Canvas. The sales-side Brief appears later so the first viewport
 * stays focused on the core transformation.
 */
export function HeroTransformShot({ brief }: { brief: ProjectBrief }) {
  const { locale } = usePublicLocale();
  const copy = (text: string) => publicCopy(locale, text);
  const demoCanvasItems: ProjectCanvasItem[] = [
    {
      id: "project",
      group: copy("Project"),
      label: copy("Project"),
      value: copy("Deck replacement"),
      status: "confirmed",
    },
    {
      id: "existing",
      group: copy("Existing"),
      label: copy("Existing site"),
      value: copy("Old timber deck"),
      status: "confirmed",
    },
    {
      id: "material",
      group: copy("Material"),
      label: copy("Material"),
      value: copy("Composite"),
      status: "approximate",
    },
    {
      id: "size",
      group: copy("Size"),
      label: copy("Size"),
      value: copy("To clarify"),
      status: "clarify",
    },
    {
      id: "next",
      group: copy("Next to understand"),
      label: copy("Next to understand"),
      value: copy("Dimensions · Access · Budget"),
      status: "neutral",
    },
  ];

  return (
    <figure className="m-0">
      <div className="metre-frame rounded-lg bg-[#fffdf8] p-4 sm:p-6 lg:p-7">
        <div className="grid gap-5 2xl:grid-cols-[minmax(220px,0.62fr)_auto_minmax(0,1.18fr)] 2xl:items-center">
          <div className="rounded-lg border border-stone-300 bg-white/75 p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
              {copy("Vague inquiry")}
            </p>
            <blockquote className="mt-4 text-2xl font-semibold leading-9 text-stone-950 lg:text-3xl lg:leading-10">
              “{copy("I'd like to replace the old deck.")}”
            </blockquote>
            <p className="mt-5 border-l border-stone-300 pl-4 text-[17px] leading-7 text-stone-700">
              {copy("Maybe composite. I'm not sure about the size.")}
            </p>
          </div>

          <div className="flex items-center justify-center">
            <span className="grid h-12 w-12 place-items-center rounded-full border border-stone-300 bg-white text-[color:var(--metre-accent)] shadow-sm">
              <ArrowRight className="h-5 w-5 rotate-90 2xl:rotate-0" aria-hidden="true" />
            </span>
          </div>

          <ProjectCanvas
            title={copy("Project Canvas")}
            eyebrow="Métré"
            items={demoCanvasItems}
            emptyText={copy("Your project will take shape as you answer.")}
            density="hero"
            maxItems={5}
          />
        </div>
        <figcaption className="mt-5 grid gap-3 border-t border-stone-200 pt-4 text-[13px] font-semibold uppercase tracking-[0.12em] text-stone-500 sm:grid-cols-3">
          <span>{copy("Vague request")}</span>
          <span>{copy("Visible uncertainty")}</span>
          <span>{copy("Project information")}</span>
        </figcaption>
      </div>
      <p className="sr-only">
        {copy("Hero demonstration for")} {brief.missionName}:{" "}
        {copy("a vague inquiry becomes a readable Project Canvas.")}
      </p>
    </figure>
  );
}
