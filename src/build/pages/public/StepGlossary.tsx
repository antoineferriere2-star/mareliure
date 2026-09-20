import { BookOpen, ChevronDown } from "lucide-react";
import type { GlossaryEntry } from "@/build/engine/glossary";

/**
 * "A word you don't know?" — collapsed by default, so a visitor who knows what
 * a spine is never has to scroll past it, and one who does not is one tap from
 * the answer. Native <details>: keyboard and screen-reader behaviour for free,
 * and nothing to break on a phone.
 */
export function StepGlossary({
  entries,
  copy,
}: {
  entries: readonly GlossaryEntry[];
  copy: (text: string) => string;
}) {
  if (entries.length === 0) return null;
  return (
    <details className="group mt-6 rounded-lg border border-stone-200 bg-[#fffdf8]">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-sm font-medium text-stone-800 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--metre-accent)] [&::-webkit-details-marker]:hidden">
        <span className="inline-flex flex-wrap items-center gap-x-2">
          <BookOpen className="h-4 w-4 text-stone-500" aria-hidden="true" />
          {copy("A word you don't know?")}
          <span className="font-normal text-stone-500">
            · {entries.length} {copy(entries.length === 1 ? "term explained" : "terms explained")}
          </span>
        </span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-stone-500 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <dl className="grid gap-3 border-t border-stone-200 px-4 py-3">
        {entries.map((entry) => (
          <div key={entry.term}>
            <dt className="text-sm font-semibold text-stone-950">{entry.term}</dt>
            <dd className="mt-0.5 text-sm leading-6 text-stone-600">{entry.definition}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
