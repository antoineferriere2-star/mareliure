import { NOT_SURE_VALUE } from "@/build/schema/answers";
import type { TextField as TextFieldDef } from "@/build/schema/playbook";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NotSureToggle } from "./NotSureToggle";
import { FIELD_ERROR_CLASS, type FieldComponentProps } from "./types";

export function TextField({ field, value, onChange, error }: FieldComponentProps<TextFieldDef>) {
  const isNotSure = value === NOT_SURE_VALUE;
  const stringValue = typeof value === "string" ? value : "";

  return (
    <div>
      <Label htmlFor={field.key}>{field.label}</Label>
      {field.helpText && <p className="mt-1 text-xs text-slate-500">{field.helpText}</p>}
      {field.multiline ? (
        <Textarea
          id={field.key}
          value={isNotSure ? "" : stringValue}
          placeholder={field.placeholder}
          disabled={isNotSure}
          onChange={(event) => onChange(event.target.value)}
          className="mt-1"
        />
      ) : (
        <Input
          id={field.key}
          value={isNotSure ? "" : stringValue}
          placeholder={field.placeholder}
          disabled={isNotSure}
          onChange={(event) => onChange(event.target.value)}
          className="mt-1"
        />
      )}
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
