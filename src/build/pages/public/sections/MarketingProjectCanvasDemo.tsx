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
  question: string;
  answer: string;
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
  {
    id: "demo-existing-site",
    group: "Site",
    label: "Existing site",
    value: "Existing deck behind the house",
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
        label: copy("Choice"),
        question: copy("What kind of project is this?"),
        answer: copy("Deck replacement"),
        note: copy("A normal answer becomes a confirmed project fact."),
        icon: MousePointer2,
        items: [
          ...BASE_CANVAS,
          {
            id: "demo-material-empty",
            group: copy("Preferences"),
            label: copy("Material"),
            value: copy("To clarify"),
            status: "clarify",
          },
        ],
      },
      {
        id: "photo",
        label: copy("Photo"),
        question: copy("Upload an inspiration or site photo."),
        answer: copy("Modern composite deck with black railing"),
        note: copy(
          "Photo interpretation stays framed as a hypothesis until the visitor confirms it.",
        ),
        icon: Camera,
        items: [
          ...BASE_CANVAS,
          {
            id: "demo-material-photo",
            group: copy("Preferences"),
            label: copy("Material"),
            value: copy("Composite decking"),
            status: "approximate",
          },
          {
            id: "demo-style-photo",
            group: copy("Preferences"),
            label: copy("Style notes"),
            value: copy("Modern railing, lighting"),
            status: "approximate",
          },
        ],
      },
      {
        id: "uncertainty",
        label: copy("Not sure"),
        question: copy("Do you know the approximate size?"),
        answer: copy("I'm not sure yet"),
        note: copy("Unknown details stay explicit instead of being turned into fake certainty."),
        icon: CircleHelp,
        items: [
          ...BASE_CANVAS,
          {
            id: "demo-material-confirmed",
            group: copy("Preferences"),
            label: copy("Material"),
            value: copy("Composite decking"),
            status: "approximate",
          },
          {
            id: "demo-size-open",
            group: copy("Dimensions"),
            label: copy("Size"),
            value: copy("To clarify"),
            status: "clarify",
          },
          {
            id: "demo-next-understand",
            group: copy("Next to understand"),
            label: copy("Sales follow-up"),
            value: copy("Dimensions, access, budget"),
            status: "neutral",
          },
        ],
      },
    ],
    [copy],
  );

  const active = moments.find((moment) => moment.id === activeMoment) ?? moments[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,0.8fr)] lg:items-start">
      <div className="space-y-3">
        {moments.map((moment) => {
          const Icon = moment.icon;
          const selected = moment.id === active.id;
          return (
            <button
              key={moment.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setActiveMoment(moment.id)}
              className={cn(
                "w-full rounded-lg border bg-[#fffdf8] p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700",
                selected
                  ? "border-stone-950 shadow-[0_18px_50px_rgba(28,25,23,0.08)]"
                  : "border-stone-200 hover:border-stone-400",
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border",
                    selected
                      ? "border-stone-950 bg-stone-950 text-white"
                      : "border-stone-300 text-stone-600",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                    {moment.label}
                  </span>
                  <span className="mt-1 block text-base font-semibold text-stone-950">
                    {moment.question}
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-stone-600">
                    {moment.answer}
                  </span>
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="lg:sticky lg:top-28">
        <ProjectCanvas
          title={copy("Project Canvas")}
          eyebrow={copy("Updates instantly")}
          items={active.items}
          emptyText={copy("Project details will appear here as the visitor answers.")}
        />
        <p className="mt-4 border-l border-stone-300 pl-4 text-sm leading-6 text-stone-600">
          {active.note}
        </p>
      </div>
    </div>
  );
}
