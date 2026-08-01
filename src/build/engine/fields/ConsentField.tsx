import type { ConsentField as ConsentFieldDef } from "@/build/schema/playbook";
import { Checkbox } from "@/components/ui/checkbox";
import { FIELD_ERROR_CLASS, type FieldComponentProps } from "./types";

export function ConsentField({
  field,
  value,
  onChange,
  error,
}: FieldComponentProps<ConsentFieldDef>) {
  const checked = value === true;
  return (
    <div>
      <label className="flex gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
        <Checkbox checked={checked} onCheckedChange={(next) => onChange(next === true)} />
        <span>{field.consentText}</span>
      </label>
      {error && <p className={FIELD_ERROR_CLASS}>{error}</p>}
    </div>
  );
}
