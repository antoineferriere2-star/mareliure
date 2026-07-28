// Replaces the old "valeur|libellé" pipe-syntax textarea with a real
// add/remove/reorder list. Generic over any row shaped like {value, label}
// (FieldOption for choice/timeline fields, plain {value,label} for budget
// ranges) — per-type extra fields (reassurance, isNotSure, urgency) are
// injected by the caller via `renderExtra`, so this component stays free of
// business logic.
import type { ReactNode } from "react";
import { slugify, uniqueSlug } from "./slug";

export interface BaseOptionRow {
  value: string;
  label: string;
}

export function OptionsListEditor<T extends BaseOptionRow>({
  options,
  onChange,
  makeOption,
  renderExtra,
}: {
  options: T[];
  onChange: (next: T[]) => void;
  makeOption: (value: string, label: string) => T;
  renderExtra?: (option: T, onPatch: (patch: Partial<T>) => void) => ReactNode;
}) {
  function updateRow(index: number, patch: Partial<T>) {
    onChange(options.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  }
  function addRow() {
    const label = `Option ${options.length + 1}`;
    const value = uniqueSlug(label, options.map((o) => o.value));
    onChange([...options, makeOption(value, label)]);
  }
  function removeRow(index: number) {
    onChange(options.filter((_, i) => i !== index));
  }
  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= options.length) return;
    const next = [...options];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="space-y-1">
      {options.map((o, i) => (
        <div key={i} className="rounded-md border border-border bg-background p-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={o.label}
              onChange={(e) => {
                const nextLabel = e.target.value;
                const otherValues = options.filter((_, j) => j !== i).map((r) => r.value);
                const wasAutoSlug = o.value === slugify(o.label);
                updateRow(i, {
                  label: nextLabel,
                  ...(wasAutoSlug ? { value: uniqueSlug(nextLabel, otherValues) } : {}),
                } as Partial<T>);
              }}
              placeholder="Label"
              className="min-w-32 flex-1 rounded-md border border-input bg-background px-2 py-1"
            />
            <input
              value={o.value}
              onChange={(e) => updateRow(i, { value: e.target.value } as Partial<T>)}
              placeholder="value"
              className="w-28 rounded-md border border-input bg-background px-2 py-1 font-mono"
            />
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="rounded-md border border-input bg-background px-1.5 py-1 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === options.length - 1}
                className="rounded-md border border-input bg-background px-1.5 py-1 disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="rounded-md border border-destructive/40 px-2 py-1 text-destructive hover:bg-destructive/10"
              >
                Remove
              </button>
            </div>
          </div>
          {renderExtra?.(o, (patch) => updateRow(i, patch))}
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-accent"
      >
        + Option
      </button>
    </div>
  );
}
