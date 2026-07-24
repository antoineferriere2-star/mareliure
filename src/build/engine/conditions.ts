/**
 * Pure condition evaluator — no framework dependency. Imported by both the
 * client (instant show/hide as the visitor answers) and the server (the
 * authority on what's actually required at save/submit time), so the two
 * can never drift apart.
 */
import { NOT_SURE_VALUE, type AnswerValue, type Answers } from "../schema/answers";
import type { Condition, ConditionGroup } from "../schema/playbook";

function isEmptyValue(value: AnswerValue | undefined): boolean {
  if (value === undefined || value === null) return true;
  if (value === NOT_SURE_VALUE) return false;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function toComparable(value: AnswerValue | undefined): string | number | boolean | undefined {
  if (value === undefined || value === NOT_SURE_VALUE) return undefined;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return undefined;
}

export function evaluateCondition(condition: Condition, answers: Answers): boolean {
  const value = answers[condition.fieldKey];
  switch (condition.operator) {
    case "is_empty":
      return isEmptyValue(value);
    case "is_not_empty":
      return !isEmptyValue(value);
    case "includes": {
      const arr = Array.isArray(value) ? value : [];
      return typeof condition.value === "string" && (arr as unknown[]).includes(condition.value);
    }
    case "not_includes": {
      const arr = Array.isArray(value) ? value : [];
      return !(typeof condition.value === "string" && (arr as unknown[]).includes(condition.value));
    }
    case "equals":
      return toComparable(value) === condition.value;
    case "not_equals":
      return toComparable(value) !== condition.value;
    case "greater_than":
    case "less_than":
    case "greater_or_equal":
    case "less_or_equal": {
      const left = toComparable(value);
      const right = condition.value;
      if (typeof left !== "number" || typeof right !== "number") return false;
      if (condition.operator === "greater_than") return left > right;
      if (condition.operator === "less_than") return left < right;
      if (condition.operator === "greater_or_equal") return left >= right;
      return left <= right;
    }
    default:
      return false;
  }
}

/** Absent group => always visible. `all` (AND) and `any` (OR) combine with AND between them. */
export function evaluateConditionGroup(group: ConditionGroup | undefined, answers: Answers): boolean {
  if (!group) return true;
  const allPass = (group.all ?? []).every((c) => evaluateCondition(c, answers));
  const anyPass = group.any ? group.any.some((c) => evaluateCondition(c, answers)) : true;
  return allPass && anyPass;
}
