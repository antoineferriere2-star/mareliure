import type { SingleChoiceField as SingleChoiceFieldDef } from "@/build/schema/playbook";
import {
  CHOICE_BUTTON_CLASS,
  FIELD_ERROR_CLASS,
  FIELD_LEGEND_CLASS,
  type FieldComponentProps,
} from "./types";

export function SingleChoiceField({
  field,
  value,
  onChange,
  error,
}: FieldComponentProps<SingleChoiceFieldDef>) {
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
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={CHOICE_BUTTON_CLASS(value === option.value)}
          >
            <span>{option.label}</span>
            {option.reassurance && (
              <span className="mt-1 block text-xs font-normal text-slate-500">
                {option.reassurance}
              </span>
            )}
          </button>
        ))}
      </div>
      {error && <p className={FIELD_ERROR_CLASS}>{error}</p>}
    </fieldset>
  );
}
