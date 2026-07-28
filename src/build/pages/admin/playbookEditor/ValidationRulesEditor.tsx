// Editor for cross-field/cross-step consistency rules (validationRules) —
// previously only editable via raw JSON. A rule's `when` describes the
// VIOLATED condition, per src/build/schema/playbook.ts's own comment.
import type { ValidationRule } from "@/build/schema/playbook";
import { ConditionGroupEditor } from "./ConditionGroupEditor";
import type { FieldSummary } from "./fieldSummaries";

export interface StepSummary {
  id: string;
  title: string;
  sectionTitle: string;
}

function newRule(): ValidationRule {
  return { id: crypto.randomUUID(), scope: "playbook", when: {}, message: "", severity: "warning" };
}

export function ValidationRulesEditor({
  rules,
  onChange,
  fields,
  steps,
}: {
  rules: ValidationRule[];
  onChange: (next: ValidationRule[]) => void;
  fields: FieldSummary[];
  steps: StepSummary[];
}) {
  function updateRule(index: number, patch: Partial<ValidationRule>) {
    onChange(rules.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  function removeRule(index: number) {
    onChange(rules.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        A rule raises a warning or an error when the condition below becomes true — phrase the
        condition as the problematic case to detect.
      </p>
      {rules.map((rule, i) => (
        <div key={rule.id} className="rounded-md border border-border bg-background p-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={rule.scope}
              onChange={(e) =>
                updateRule(i, {
                  scope: e.target.value as ValidationRule["scope"],
                  stepId: e.target.value === "playbook" ? undefined : rule.stepId,
                })
              }
              className="rounded-md border border-input bg-background px-2 py-1 text-xs"
            >
              <option value="playbook">Entire Playbook</option>
              <option value="step">A specific step</option>
            </select>
            {rule.scope === "step" && (
              <select
                value={rule.stepId ?? ""}
                onChange={(e) => updateRule(i, { stepId: e.target.value })}
                className="rounded-md border border-input bg-background px-2 py-1 text-xs"
              >
                <option value="" disabled>
                  — Select a step —
                </option>
                {steps.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.sectionTitle} → {s.title}
                  </option>
                ))}
              </select>
            )}
            <select
              value={rule.severity}
              onChange={(e) => updateRule(i, { severity: e.target.value as ValidationRule["severity"] })}
              className="rounded-md border border-input bg-background px-2 py-1 text-xs"
            >
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
            <button
              type="button"
              onClick={() => removeRule(i)}
              className="ml-auto rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
            >
              Remove
            </button>
          </div>
          <input
            value={rule.message}
            onChange={(e) => updateRule(i, { message: e.target.value })}
            placeholder="Message shown when the rule is triggered"
            className="mt-2 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
          />
          <div className="mt-2">
            <span className="text-xs font-medium text-muted-foreground">This rule triggers when…</span>
            <div className="mt-1">
              <ConditionGroupEditor
                group={rule.when}
                onChange={(next) => updateRule(i, { when: next ?? {} })}
                fields={fields}
                emptyHint="This rule never triggers (no condition defined)."
              />
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rules, newRule()])}
        className="rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent"
      >
        + Rule
      </button>
    </div>
  );
}
