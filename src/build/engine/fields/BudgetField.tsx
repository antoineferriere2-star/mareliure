import type { BudgetField as BudgetFieldDef } from "@/build/schema/playbook";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CHOICE_BUTTON_CLASS,
  FIELD_ERROR_CLASS,
  FIELD_LEGEND_CLASS,
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
        <legend className={FIELD_LEGEND_CLASS}>{field.label}</legend>
        {field.helpText && <p className="mb-2 text-xs text-slate-500">{field.helpText}</p>}
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={field.label}>
          {(field.ranges ?? []).map((range) => (
            <button
              key={range.value}
              type="button"
              role="radio"
              aria-checked={selected === range.value}
              onClick={() => onChange(range.value)}
              className={CHOICE_BUTTON_CLASS(selected === range.value)}
            >
              {range.label}
            </button>
          ))}
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
      {field.helpText && <p className="mt-1 text-xs text-slate-500">{field.helpText}</p>}
      <div className="mt-1 flex items-center gap-2">
        <span className="text-sm text-slate-500">{field.currency}</span>
        <Input
          id={field.key}
          type="number"
          min={field.min}
          max={field.max}
          value={stringValue}
          onChange={(event) =>
            onChange(event.target.value === "" ? "" : Number(event.target.value))
          }
        />
      </div>
      {error && <p className={FIELD_ERROR_CLASS}>{error}</p>}
    </div>
  );
}
