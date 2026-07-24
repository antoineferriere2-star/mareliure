import type { SingleChoiceField as SingleChoiceFieldDef } from "@/build/schema/playbook";
import { CHOICE_BUTTON_CLASS, type FieldComponentProps } from "./types";

export function SingleChoiceField({ field, value, onChange }: FieldComponentProps<SingleChoiceFieldDef>) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {field.options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={CHOICE_BUTTON_CLASS(value === option.value)}
        >
          <span>{option.label}</span>
          {option.reassurance && <span className="mt-1 block text-xs font-normal text-slate-500">{option.reassurance}</span>}
        </button>
      ))}
    </div>
  );
}
