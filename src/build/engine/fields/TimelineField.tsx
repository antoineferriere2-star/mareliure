import type { TimelineField as TimelineFieldDef } from "@/build/schema/playbook";
import { CHOICE_BUTTON_CLASS, type FieldComponentProps } from "./types";

export function TimelineField({ field, value, onChange }: FieldComponentProps<TimelineFieldDef>) {
  const selected = typeof value === "string" ? value : "";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {field.options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={CHOICE_BUTTON_CLASS(selected === option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
