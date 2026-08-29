import type { BudgetField as BudgetFieldDef } from "@/build/schema/playbook";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CHOICE_BUTTON_CLASS,
  FIELD_ERROR_CLASS,
  FIELD_LEGEND_CLASS,
  RequiredMark,
  type FieldComponentProps,
} from "./types";

export function BudgetField({
  field,
  value,
  onChange,
  error,
}: FieldComponentProps<BudgetFieldDef>) {
  if (field.mode === "ranges") {
    const selected = typeof value === "string" ? value : "";
    return (
      <fieldset>
        <legend className={FIELD_LEGEND_CLASS}>
          {field.label}
          <RequiredMark field={field} />
        </legend>
        {field.helpText && (
          <p className="mb-4 text-sm leading-6 text-stone-600">{field.helpText}</p>
        )}
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={field.label}>
          {(field.ranges ?? []).map((range) => {
            const isSelected = selected === range.value;
            return (
              <button
                key={range.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onChange(range.value)}
                className={CHOICE_BUTTON_CLASS(isSelected)}
              >
                <span className="flex items-start justify-between gap-3">
                  <span>{range.label}</span>
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs transition ${
                      isSelected
                        ? "border-[color:var(--metre-accent)] bg-[color:var(--metre-accent)] text-white"
                        : "border-stone-300 text-transparent group-hover:text-stone-300"
                    }`}
                    aria-hidden="true"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {error && <p className={FIELD_ERROR_CLASS}>{error}</p>}
      </fieldset>
    );
  }

  const stringValue =
    typeof value === "number" ? String(value) : typeof value === "string" ? value : "";
  return (
    <div>
      <Label htmlFor={field.key}>{field.label}</Label>
      {field.helpText && <p className="mt-2 text-sm leading-6 text-stone-600">{field.helpText}</p>}
      <div className="mt-3 flex items-center gap-3 rounded-lg border border-stone-300 bg-[#fffdf8] px-4 py-3 focus-within:ring-2 focus-within:ring-[color:var(--metre-accent)]">
        <span className="text-sm font-semibold text-stone-500">{field.currency}</span>
        <Input
          id={field.key}
          type="number"
          min={field.min}
          max={field.max}
          value={stringValue}
          onChange={(event) =>
            onChange(event.target.value === "" ? "" : Number(event.target.value))
          }
          className="h-10 border-0 bg-transparent p-0 text-lg shadow-none focus-visible:ring-0"
        />
      </div>
      {error && <p className={FIELD_ERROR_CLASS}>{error}</p>}
    </div>
  );
}
