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
      <label className="flex gap-3 rounded-lg border border-stone-300 bg-[#fffdf8] p-4 text-sm leading-6 text-stone-800">
        <Checkbox checked={checked} onCheckedChange={(next) => onChange(next === true)} />
        <span>{field.consentText}</span>
      </label>
      {error && <p className={FIELD_ERROR_CLASS}>{error}</p>}
    </div>
  );
}
