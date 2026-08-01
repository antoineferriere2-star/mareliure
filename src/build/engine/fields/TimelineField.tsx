import type { TimelineField as TimelineFieldDef } from "@/build/schema/playbook";
import {
  CHOICE_BUTTON_CLASS,
  FIELD_ERROR_CLASS,
  FIELD_LEGEND_CLASS,
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
      <legend className={FIELD_LEGEND_CLASS}>{field.label}</legend>
      {field.helpText && <p className="mb-2 text-xs text-slate-500">{field.helpText}</p>}
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={field.label}>
        {field.options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected === option.value}
            onClick={() => onChange(option.value)}
            className={CHOICE_BUTTON_CLASS(selected === option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {error && <p className={FIELD_ERROR_CLASS}>{error}</p>}
    </fieldset>
  );
}
