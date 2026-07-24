// Visual builder for ConditionGroup ({all, any}) — the pivot component reused
// by field.displayWhen, step.displayWhen, validationRule.when,
// summaryFragment/derivedLineRule/suggestedNextActionRule.when. Must produce
// exactly the shape src/build/engine/conditions.ts#evaluateConditionGroup
// consumes: an absent group means "always true", so an editor that empties
// out both lists collapses back to `undefined` rather than an empty object.
import type { Condition, ConditionGroup, ConditionOperator } from "@/build/schema/playbook";
import type { FieldSummary } from "./fieldSummaries";
import { FieldPicker } from "./FieldPicker";

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: "est égal à",
  not_equals: "est différent de",
  includes: "contient",
  not_includes: "ne contient pas",
  is_empty: "est vide",
  is_not_empty: "n'est pas vide",
  greater_than: "est supérieur à",
  less_than: "est inférieur à",
  greater_or_equal: "est supérieur ou égal à",
  less_or_equal: "est inférieur ou égal à",
};

const OPERATORS = Object.keys(OPERATOR_LABELS) as ConditionOperator[];

function needsValue(operator: ConditionOperator): boolean {
  return operator !== "is_empty" && operator !== "is_not_empty";
}

function isNumericOperator(operator: ConditionOperator): boolean {
  return (
    operator === "greater_than" ||
    operator === "less_than" ||
    operator === "greater_or_equal" ||
    operator === "less_or_equal"
  );
}

function newCondition(fields: FieldSummary[]): Condition {
  return { fieldKey: fields[0]?.key ?? "", operator: "is_not_empty" };
}

function conditionGroupOrUndefined(all: Condition[], any: Condition[]): ConditionGroup | undefined {
  if (all.length === 0 && any.length === 0) return undefined;
  const next: ConditionGroup = {};
  if (all.length > 0) next.all = all;
  if (any.length > 0) next.any = any;
  return next;
}

function ConditionRow({
  condition,
  fields,
  onChange,
  onRemove,
}: {
  condition: Condition;
  fields: FieldSummary[];
  onChange: (next: Condition) => void;
  onRemove: () => void;
}) {
  const field = fields.find((f) => f.key === condition.fieldKey);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background p-2 text-xs">
      <FieldPicker fields={fields} value={condition.fieldKey} onChange={(key) => onChange({ ...condition, fieldKey: key })} />
      <select
        value={condition.operator}
        onChange={(e) => onChange({ ...condition, operator: e.target.value as ConditionOperator, value: undefined })}
        className="rounded-md border border-input bg-background px-2 py-1"
      >
        {OPERATORS.map((op) => (
          <option key={op} value={op}>
            {OPERATOR_LABELS[op]}
          </option>
        ))}
      </select>
      {needsValue(condition.operator) &&
        (field?.options ? (
          <select
            value={typeof condition.value === "string" ? condition.value : ""}
            onChange={(e) => onChange({ ...condition, value: e.target.value })}
            className="rounded-md border border-input bg-background px-2 py-1"
          >
            <option value="" disabled>
              — valeur —
            </option>
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : isNumericOperator(condition.operator) ? (
          <input
            type="number"
            value={typeof condition.value === "number" ? condition.value : ""}
            onChange={(e) => onChange({ ...condition, value: e.target.value === "" ? undefined : Number(e.target.value) })}
            className="w-24 rounded-md border border-input bg-background px-2 py-1"
          />
        ) : (
          <input
            value={typeof condition.value === "string" ? condition.value : ""}
            onChange={(e) => onChange({ ...condition, value: e.target.value })}
            className="w-32 rounded-md border border-input bg-background px-2 py-1"
          />
        ))}
      <button
        type="button"
        onClick={onRemove}
        className="ml-auto rounded-md border border-destructive/40 px-2 py-1 text-destructive hover:bg-destructive/10"
      >
        Retirer
      </button>
    </div>
  );
}

export function ConditionGroupEditor({
  group,
  onChange,
  fields,
  emptyHint = "Toujours affiché (aucune condition).",
}: {
  group: ConditionGroup | undefined;
  onChange: (next: ConditionGroup | undefined) => void;
  fields: FieldSummary[];
  emptyHint?: string;
}) {
  const all = group?.all ?? [];
  const any = group?.any ?? [];

  function updateAll(next: Condition[]) {
    onChange(conditionGroupOrUndefined(next, any));
  }
  function updateAny(next: Condition[]) {
    onChange(conditionGroupOrUndefined(all, next));
  }

  if (fields.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Ajoutez au moins un champ au Playbook pour pouvoir créer une condition.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {all.length === 0 && any.length === 0 && <p className="text-xs text-muted-foreground">{emptyHint}</p>}

      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Toutes ces conditions (ET)</span>
          <button
            type="button"
            onClick={() => updateAll([...all, newCondition(fields)])}
            className="rounded-md border border-input bg-background px-2 py-0.5 text-xs hover:bg-accent"
          >
            + Condition
          </button>
        </div>
        <div className="mt-1 space-y-1">
          {all.map((c, i) => (
            <ConditionRow
              key={i}
              condition={c}
              fields={fields}
              onChange={(next) => updateAll(all.map((c2, j) => (j === i ? next : c2)))}
              onRemove={() => updateAll(all.filter((_, j) => j !== i))}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Au moins une de ces conditions (OU)</span>
          <button
            type="button"
            onClick={() => updateAny([...any, newCondition(fields)])}
            className="rounded-md border border-input bg-background px-2 py-0.5 text-xs hover:bg-accent"
          >
            + Condition
          </button>
        </div>
        <div className="mt-1 space-y-1">
          {any.map((c, i) => (
            <ConditionRow
              key={i}
              condition={c}
              fields={fields}
              onChange={(next) => updateAny(any.map((c2, j) => (j === i ? next : c2)))}
              onRemove={() => updateAny(any.filter((_, j) => j !== i))}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
