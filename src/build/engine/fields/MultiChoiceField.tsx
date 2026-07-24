import type { MultiChoiceField as MultiChoiceFieldDef } from "@/build/schema/playbook";
import { CHOICE_BUTTON_CLASS, type FieldComponentProps } from "./types";

export function MultiChoiceField({ field, value, onChange }: FieldComponentProps<MultiChoiceFieldDef>) {
  const selected = Array.isArray(value) ? (value as string[]) : [];
  function toggle(optionValue: string) {
    onChange(selected.includes(optionValue) ? selected.filter((v) => v !== optionValue) : [...selected, optionValue]);
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {field.options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => toggle(option.value)}
          className={CHOICE_BUTTON_CLASS(selected.includes(option.value))}
        >
          <span>{option.label}</span>
          {option.reassurance && <span className="mt-1 block text-xs font-normal text-slate-500">{option.reassurance}</span>}
        </button>
      ))}
    </div>
  );
}
