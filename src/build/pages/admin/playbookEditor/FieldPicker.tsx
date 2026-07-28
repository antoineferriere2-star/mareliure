import type { FieldSummary } from "./fieldSummaries";

export function FieldPicker({
  fields,
  value,
  onChange,
  placeholder = "— Select a field —",
  className,
}: {
  fields: FieldSummary[];
  value: string | undefined;
  onChange: (key: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className={className ?? "rounded-md border border-input bg-background px-2 py-1 text-xs"}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {fields.map((f) => (
        <option key={f.key} value={f.key}>
          {f.label} ({f.key})
        </option>
      ))}
    </select>
  );
}
