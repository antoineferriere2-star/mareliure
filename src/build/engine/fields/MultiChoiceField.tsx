import type { MultiChoiceField as MultiChoiceFieldDef } from "@/build/schema/playbook";
import {
  CHOICE_BUTTON_CLASS,
  FIELD_ERROR_CLASS,
  FIELD_LEGEND_CLASS,
  RequiredMark,
  type FieldComponentProps,
} from "./types";

export function MultiChoiceField({
  field,
  value,
  onChange,
  error,
}: FieldComponentProps<MultiChoiceFieldDef>) {
  const selected = Array.isArray(value) ? (value as string[]) : [];
  function toggle(optionValue: string) {
    onChange(
      selected.includes(optionValue)
        ? selected.filter((v) => v !== optionValue)
        : [...selected, optionValue],
    );
  }
  return (
    <fieldset>
      <legend className={FIELD_LEGEND_CLASS}>
        {field.label}
        <RequiredMark field={field} />
      </legend>
      {field.helpText && <p className="mb-2 text-xs text-slate-500">{field.helpText}</p>}
      <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label={field.label}>
        {field.options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected.includes(option.value)}
            onClick={() => toggle(option.value)}
            className={CHOICE_BUTTON_CLASS(selected.includes(option.value))}
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
