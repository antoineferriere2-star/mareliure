import type { AddressAnswerValue } from "@/build/schema/answers";
import type { AddressField as AddressFieldDef } from "@/build/schema/playbook";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FIELD_ERROR_CLASS, type FieldComponentProps, RequiredMark } from "./types";

export function AddressField({
  field,
  value,
  onChange,
  error,
}: FieldComponentProps<AddressFieldDef>) {
  const current: AddressAnswerValue =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as AddressAnswerValue)
      : {};

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
        {field.components.map((component, index) => (
          <div key={component.key}>
            <Label htmlFor={`${field.key}-${component.key}`}>
              {component.label}
              {/* Once, on the first part: the requirement is the address, not
                  each line of it. */}
              {index === 0 && <RequiredMark field={field} />}
            </Label>
            <Input
              id={`${field.key}-${component.key}`}
              value={current[component.key] ?? ""}
              onChange={(event) => onChange({ ...current, [component.key]: event.target.value })}
              className="mt-1"
            />
          </div>
        ))}
      </div>
      {error && <p className={FIELD_ERROR_CLASS}>{error}</p>}
    </div>
  );
}
