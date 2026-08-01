import { NOT_SURE_VALUE } from "@/build/schema/answers";
import type { NumberField as NumberFieldDef } from "@/build/schema/playbook";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NotSureToggle } from "./NotSureToggle";
import { FIELD_ERROR_CLASS, type FieldComponentProps } from "./types";

export function NumberField({
  field,
  value,
  onChange,
  error,
}: FieldComponentProps<NumberFieldDef>) {
  const isNotSure = value === NOT_SURE_VALUE;
  const stringValue =
    typeof value === "number" ? String(value) : typeof value === "string" ? value : "";

  return (
    <div>
      <Label htmlFor={field.key}>{field.label}</Label>
      {field.helpText && <p className="mt-1 text-xs text-slate-500">{field.helpText}</p>}
      <Input
        id={field.key}
        type="number"
        min={field.min}
        max={field.max}
        step={field.step}
        value={isNotSure ? "" : stringValue}
        disabled={isNotSure}
        onChange={(event) => onChange(event.target.value === "" ? "" : Number(event.target.value))}
        className="mt-1"
      />
      {field.allowNotSure && (
        <NotSureToggle
          active={isNotSure}
          onToggle={(nowNotSure) => onChange(nowNotSure ? NOT_SURE_VALUE : "")}
        />
      )}
      {error && <p className={FIELD_ERROR_CLASS}>{error}</p>}
    </div>
  );
}
