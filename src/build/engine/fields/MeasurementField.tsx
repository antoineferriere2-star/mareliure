import { NOT_SURE_VALUE } from "@/build/schema/answers";
import type { MeasurementField as MeasurementFieldDef } from "@/build/schema/playbook";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NotSureToggle } from "./NotSureToggle";
import { FIELD_ERROR_CLASS, type FieldComponentProps, RequiredMark } from "./types";

export function MeasurementField({
  field,
  value,
  onChange,
  error,
}: FieldComponentProps<MeasurementFieldDef>) {
  const isNotSure = value === NOT_SURE_VALUE;
  const stringValue =
    typeof value === "number" ? String(value) : typeof value === "string" ? value : "";
  // Some already-published Playbook versions have the unit baked into the
  // label itself (e.g. "Length (ft)") from before field.unit was appended
  // generically here — appending it again produced "Length (ft) (ft)".
  // Guarding on the label's own text keeps this correct for both old and
  // new label conventions without needing that Playbook republished.
  const labelAlreadyShowsUnit = field.label.trim().endsWith(`(${field.unit})`);

  return (
    <div>
      <Label htmlFor={field.key}>
        {field.label}
        <RequiredMark field={field} />
        {!labelAlreadyShowsUnit && (
          <span className="text-sm font-normal text-stone-500"> ({field.unit})</span>
        )}
      </Label>
      {field.helpText && <p className="mt-2 text-sm leading-6 text-stone-600">{field.helpText}</p>}
      <Input
        id={field.key}
        type="number"
        min={field.min}
        max={field.max}
        value={isNotSure ? "" : stringValue}
        disabled={isNotSure}
        onChange={(event) => onChange(event.target.value === "" ? "" : Number(event.target.value))}
        className="mt-3 h-12 rounded-lg border-stone-300 bg-[#fffdf8] text-lg focus-visible:ring-[color:var(--metre-accent)]"
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
