import { Camera, CircleHelp, MousePointer2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { ProjectCanvas } from "@/build/pages/public/ProjectCanvas";
import type { ProjectCanvasItem } from "@/build/pages/public/ProjectCanvasProjection";
import { publicCopy, usePublicLocale } from "@/build/pages/public/publicLocaleContext";
import { cn } from "@/lib/utils";

type MomentId = "choice" | "photo" | "uncertainty";

interface DemoMoment {
  id: MomentId;
  label: string;
  eyebrow: string;
  question: string;
  answer: string;
  option: string;
  note: string;
  icon: typeof MousePointer2;
  items: ProjectCanvasItem[];
}

const BASE_CANVAS: ProjectCanvasItem[] = [
  {
    id: "demo-project-type",
    group: "Project",
    label: "Project",
    value: "Deck replacement",
    status: "confirmed",
  },
];

export function MarketingProjectCanvasDemo() {
  const { locale } = usePublicLocale();
  const copy = useCallback((text: string) => publicCopy(locale, text), [locale]);
  const [activeMoment, setActiveMoment] = useState<MomentId>("choice");

  const moments = useMemo<DemoMoment[]>(
    () => [
      {
        id: "choice",
        label: copy("Answer"),
        eyebrow: copy("Question"),
        question: copy("What are you starting with?"),
        answer: copy("Existing wood deck"),
        option: copy("Existing wood deck"),
        note: copy("One answer becomes confirmed project information."),
        icon: MousePointer2,
        items: [
          ...BASE_CANVAS,
          {
            id: "demo-existing-site",
            group: copy("Existing site"),
            label: copy("Starting point"),
            value: copy("Timber deck"),
            status: "confirmed",
          },
          {
            id: "demo-material-empty",
            group: copy("Material"),
            label: copy("Material"),
            value: copy("To clarify"),
            status: "clarify",
          },
        ],
      },
      {
        id: "photo",
        label: copy("Photo"),
        eyebrow: copy("Photo"),
        question: copy("Customer adds inspiration."),
        answer: copy("Modern deck with dark railing"),
        option: copy("Inspiration photo added"),
        note: copy("Photo interpretation stays approximate until the customer confirms it."),
        icon: Camera,
        items: [
          ...BASE_CANVAS,
          {
            id: "demo-style-photo",
            group: copy("Style"),
            label: copy("Style"),
            value: copy("Modern"),
            status: "approximate",
          },
          {
            id: "demo-material-photo",
            group: copy("Material"),
            label: copy("Material"),
            value: copy("Timber appearance"),
            status: "approximate",
          },
        ],
      },
      {
        id: "uncertainty",
        label: copy("Uncertainty"),
        eyebrow: copy("Question"),
        question: copy("Do you know the approximate size?"),
        answer: copy("I'm not sure yet"),
        option: copy("Not sure yet"),
        note: copy("Unknown details stay visible as the next sales follow-up."),
        icon: CircleHelp,
        items: [
          ...BASE_CANVAS,
          {
            id: "demo-size-open",
            group: copy("Size"),
            label: copy("Size"),
            value: copy("To clarify"),
            status: "clarify",
          },
          {
            id: "demo-next-understand",
            group: copy("Next to understand"),
            label: copy("Sales follow-up"),
            value: copy("Dimensions · Access · Budget"),
            status: "neutral",
          },
        ],
      },
    ],
    [copy],
  );

  const active = moments.find((moment) => moment.id === activeMoment) ?? moments[0];
  const ActiveIcon = active.icon;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(260px,0.68fr)_minmax(0,1.32fr)] lg:items-start">
      <div className="lg:sticky lg:top-28">
        <div className="border-y border-stone-300 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
            {active.eyebrow}
          </p>
          <h3 className="mt-3 text-3xl font-semibold leading-tight tracking-normal text-stone-950">
            {active.question}
          </h3>
          <button
            type="button"
            onClick={() => setActiveMoment(active.id)}
            className="mt-6 inline-flex w-full items-center justify-between rounded-lg border border-stone-950 bg-[#fffdf8] px-4 py-4 text-left text-base font-semibold text-stone-950 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 sm:w-auto sm:min-w-64"
          >
            <span className="flex min-w-0 items-center gap-3">
              <ActiveIcon className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
              <span>{active.option}</span>
            </span>
            <span className="ml-4 text-emerald-700" aria-hidden="true">
              ✓
            </span>
          </button>
          <p className="mt-5 text-[17px] leading-7 text-stone-700">{active.answer}</p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2" aria-label={copy("Project moments")}>
          {moments.map((moment) => (
            <button
              key={moment.id}
              type="button"
              aria-pressed={moment.id === active.id}
              onClick={() => setActiveMoment(moment.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700",
                moment.id === active.id
                  ? "border-stone-950 bg-stone-950 text-white"
                  : "border-stone-300 text-stone-600 hover:border-stone-950 hover:text-stone-950",
              )}
            >
              {moment.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <ProjectCanvas
          key={active.id}
          title={copy("Project Canvas")}
          eyebrow={copy("Updates instantly")}
          items={active.items}
          emptyText={copy("Project details will appear here as the visitor answers.")}
          density="marketing"
          maxItems={4}
        />
        <p className="mt-5 border-l border-stone-300 pl-4 text-[15px] leading-6 text-stone-600">
          {active.note}
        </p>
      </div>
    </div>
  );
}
