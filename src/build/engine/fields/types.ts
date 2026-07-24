import type { AnswerValue } from "@/build/schema/answers";
import type { PlaybookField } from "@/build/schema/playbook";

/**
 * Shared contract for every generic field component. A component reads its
 * config entirely from `field` (options, labels, units, thresholds...) — it
 * must never hardcode copy or business rules itself (CLAUDE.md).
 */
export interface FieldComponentProps<F extends PlaybookField = PlaybookField> {
  field: F;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
  error?: string | null;
  disabled?: boolean;
}

export const CHOICE_BUTTON_CLASS = (selected: boolean) =>
  `rounded-md border p-4 text-left text-sm font-medium ${
    selected ? "border-emerald-500 bg-emerald-50 text-emerald-950" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
  }`;
