import { ChevronRight } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { ProjectCanvasItem, ProjectCanvasStatus } from "./ProjectCanvasProjection";

const STATUS_META: Record<ProjectCanvasStatus, { mark: string; label: string; className: string }> =
  {
    confirmed: { mark: "✓", label: "Confirmed", className: "text-emerald-700" },
    approximate: { mark: "~", label: "Approximate", className: "text-amber-700" },
    derived: { mark: "◇", label: "Derived", className: "text-indigo-700" },
    clarify: { mark: "○", label: "To clarify", className: "text-stone-500" },
    neutral: { mark: "•", label: "Captured", className: "text-stone-600" },
  };

function groupedItems(items: ProjectCanvasItem[]) {
  const groups: Array<{ title: string; items: ProjectCanvasItem[] }> = [];
  for (const item of items) {
    let group = groups.find((entry) => entry.title === item.group);
    if (!group) {
      group = { title: item.group, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

export function ProjectCanvas({
  title,
  eyebrow,
  items,
  emptyText,
  className,
}: {
  title: string;
  eyebrow?: string;
  items: ProjectCanvasItem[];
  emptyText: string;
  className?: string;
}) {
  const groups = groupedItems(items);

  return (
    <aside className={cn("metre-frame project-canvas rounded-lg bg-[#fffdf8] p-5", className)}>
      {eyebrow && (
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-1 text-xl font-semibold tracking-normal text-stone-950">{title}</h2>
      <div className="mt-5 space-y-5">
        {groups.length === 0 ? (
          <p className="border-l border-stone-300 pl-4 text-sm leading-6 text-stone-600">
            {emptyText}
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.title} className="project-canvas-group">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">
                {group.title}
              </h3>
              <dl className="mt-2 space-y-1.5">
                {group.items.map((item) => {
                  const meta = STATUS_META[item.status];
                  return (
                    <div
                      key={item.id}
                      className="project-canvas-item grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-t border-stone-200 py-2.5 first:border-t-0"
                    >
                      <div className="min-w-0">
                        <dt className="text-[12px] font-medium text-stone-500">{item.label}</dt>
                        <dd className="mt-0.5 break-words text-[15px] leading-6 text-stone-950">
                          {item.value}
                        </dd>
                      </div>
                      <span
                        className={cn(
                          "mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-current text-sm",
                          meta.className,
                        )}
                        title={meta.label}
                        aria-label={meta.label}
                      >
                        {meta.mark}
                      </span>
                    </div>
                  );
                })}
              </dl>
            </section>
          ))
        )}
      </div>
    </aside>
  );
}

export function ProjectCanvasMobileSheet({
  items,
  title,
  triggerLabel,
  description,
  emptyText,
}: {
  items: ProjectCanvasItem[];
  title: string;
  triggerLabel: string;
  description: string;
  emptyText: string;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-lg border border-stone-300 bg-[#fffdf8] px-4 py-3 text-left text-sm font-medium text-stone-900 shadow-sm lg:hidden"
        >
          <span>{triggerLabel}</span>
          <ChevronRight className="h-4 w-4 text-stone-500" aria-hidden="true" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[85svh] overflow-y-auto rounded-t-lg bg-[#f7f3ec] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="pr-8 text-left">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <ProjectCanvas title={title} items={items} emptyText={emptyText} className="mt-4" />
      </SheetContent>
    </Sheet>
  );
}
