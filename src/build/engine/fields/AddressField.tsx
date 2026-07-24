import type { AddressAnswerValue } from "@/build/schema/answers";
import type { AddressField as AddressFieldDef } from "@/build/schema/playbook";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FieldComponentProps } from "./types";

export function AddressField({ field, value, onChange }: FieldComponentProps<AddressFieldDef>) {
  const current: AddressAnswerValue = value && typeof value === "object" && !Array.isArray(value) ? (value as AddressAnswerValue) : {};

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {field.components.map((component) => (
        <div key={component.key}>
          <Label htmlFor={`${field.key}-${component.key}`}>{component.label}</Label>
          <Input
            id={`${field.key}-${component.key}`}
            value={current[component.key] ?? ""}
            onChange={(event) => onChange({ ...current, [component.key]: event.target.value })}
            className="mt-1"
          />
        </div>
      ))}
    </div>
  );
}
