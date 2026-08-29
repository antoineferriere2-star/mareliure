import type { TimelineField as TimelineFieldDef } from "@/build/schema/playbook";
import { Check } from "lucide-react";
import {
  CHOICE_BUTTON_CLASS,
  FIELD_ERROR_CLASS,
  FIELD_LEGEND_CLASS,
  RequiredMark,
  type FieldComponentProps,
} from "./types";

export function TimelineField({
  field,
  value,
  onChange,
  error,
}: FieldComponentProps<TimelineFieldDef>) {
  const selected = typeof value === "string" ? value : "";
  return (
    <fieldset>
      <legend className={FIELD_LEGEND_CLASS}>
        {field.label}
        <RequiredMark field={field} />
      </legend>
      {field.helpText && <p className="mb-4 text-sm leading-6 text-stone-600">{field.helpText}</p>}
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={field.label}>
        {field.options.map((option) => {
          const isSelected = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(option.value)}
              className={CHOICE_BUTTON_CLASS(isSelected)}
            >
              <span className="flex items-start justify-between gap-3">
                <span>{option.label}</span>
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
