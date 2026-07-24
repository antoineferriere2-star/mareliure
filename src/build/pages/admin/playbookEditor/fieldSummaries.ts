// Flat, read-only view of every field defined anywhere in a PlaybookSchema —
// used everywhere a condition, calculated field, or brief-mapping picker
// needs to reference "some other field" by key.
import type { PlaybookFieldType, PlaybookSchema } from "@/build/schema/playbook";

export interface FieldSummary {
  key: string;
  label: string;
  type: PlaybookFieldType;
  options?: { value: string; label: string }[];
}

export function collectFieldSummaries(schema: PlaybookSchema): FieldSummary[] {
  const out: FieldSummary[] = [];
  for (const section of schema.sections) {
    for (const step of section.steps) {
      for (const field of step.fields) {
        out.push({
          key: field.key,
          label: field.label,
          type: field.type,
          options: "options" in field ? field.options.map((o) => ({ value: o.value, label: o.label })) : undefined,
        });
      }
    }
  }
  return out;
}
