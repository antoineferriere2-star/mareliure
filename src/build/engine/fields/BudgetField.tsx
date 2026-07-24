import type { BudgetField as BudgetFieldDef } from "@/build/schema/playbook";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CHOICE_BUTTON_CLASS, type FieldComponentProps } from "./types";

export function BudgetField({ field, value, onChange }: FieldComponentProps<BudgetFieldDef>) {
  if (field.mode === "ranges") {
    const selected = typeof value === "string" ? value : "";
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {(field.ranges ?? []).map((range) => (
          <button
            key={range.value}
            type="button"
            onClick={() => onChange(range.value)}
            className={CHOICE_BUTTON_CLASS(selected === range.value)}
          >
            {range.label}
          </button>
        ))}
      </div>
    );
  }

  const stringValue = typeof value === "number" ? String(value) : typeof value === "string" ? value : "";
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
          onChange={(event) => onChange(event.target.value === "" ? "" : Number(event.target.value))}
        />
      </div>
    </div>
  );
}
