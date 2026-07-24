import { NOT_SURE_VALUE } from "@/build/schema/answers";
import type { MeasurementField as MeasurementFieldDef } from "@/build/schema/playbook";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NotSureToggle } from "./NotSureToggle";
import type { FieldComponentProps } from "./types";

export function MeasurementField({ field, value, onChange }: FieldComponentProps<MeasurementFieldDef>) {
  const isNotSure = value === NOT_SURE_VALUE;
  const stringValue = typeof value === "number" ? String(value) : typeof value === "string" ? value : "";

  return (
    <div>
      <Label htmlFor={field.key}>
        {field.label} <span className="text-xs font-normal text-slate-500">({field.unit})</span>
      </Label>
      {field.helpText && <p className="mt-1 text-xs text-slate-500">{field.helpText}</p>}
      <Input
        id={field.key}
        type="number"
        min={field.min}
        max={field.max}
        value={isNotSure ? "" : stringValue}
        disabled={isNotSure}
        onChange={(event) => onChange(event.target.value === "" ? "" : Number(event.target.value))}
        className="mt-1"
      />
      {field.allowNotSure && (
        <NotSureToggle active={isNotSure} onToggle={(nowNotSure) => onChange(nowNotSure ? NOT_SURE_VALUE : "")} />
      )}
    </div>
  );
}
