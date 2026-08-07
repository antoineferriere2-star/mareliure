/**
 * The Vérificateur: the runtime for a Playbook's `validationRules`.
 *
 * Field-level validation (engine/validation.ts) answers "is this one answer
 * well-formed?". These rules answer the question only the trade expert can
 * ask: "do these answers, taken together, describe a real project?" — an
 * elevated deck with no stairs, a two-week timeline on a permit-bound scope,
 * an area that contradicts the stated dimensions. That expertise belongs to
 * the Playbook, so this module never knows a single trade: it interprets
 * rules, it does not hold any.
 *
 * Pure, framework-free, and shared by the client (immediate feedback as the
 * visitor progresses) and the server (the authority at submit time), exactly
 * like validation.ts — the two can never drift.
 */
import type { Answers } from "../schema/answers";
import type { PlaybookSchema, ValidationRule } from "../schema/playbook";
import { collectConditionFieldKeys, evaluateConditionGroup, hasAnyCondition } from "./conditions";
import { computeVisibleSteps } from "./validation";

export interface TriggeredConsistency {
  /** Rules the visitor must resolve — they block the step and the submit. */
  errors: ValidationRule[];
  /** Rules the visitor is told about and may knowingly move past. */
  warnings: ValidationRule[];
}

const NOTHING: TriggeredConsistency = { errors: [], warnings: [] };

/**
 * Which step currently asks each field. A field in no visible step is absent
 * from the map: either its `displayWhen` excludes it from this visitor's
 * journey, or the key is dangling (getPlaybookPublishIssues refuses that at
 * publish time, but a rule must stay harmless if one ever slips through).
 */
function stepIdByFieldKey(schema: PlaybookSchema, answers: Answers): Map<string, string> {
  const map = new Map<string, string>();
  for (const { step, visibleFields } of computeVisibleSteps(schema, answers)) {
    for (const field of visibleFields) {
      if (!map.has(field.key)) map.set(field.key, step.id);
    }
  }
  return map;
}

/**
 * A rule may only run once every field it reads has actually been asked.
 * Without this, a rule like "area is over 400 and permit_status is empty"
 * would fire on the very first step — the visitor has not reached the permit
 * question yet, so of course it is empty. Firing there would train visitors
 * to dismiss the Vérificateur, which is worse than not having one.
 *
 * A field that belongs to no visible step is treated as never-asked rather
 * than as empty, for the same reason: its absence is the Playbook's own
 * branching decision, not a contradiction by the visitor.
 */
function isEvaluable(
  rule: ValidationRule,
  fieldSteps: Map<string, string>,
  reachedStepIds: ReadonlySet<string>,
): boolean {
  for (const fieldKey of collectConditionFieldKeys(rule.when)) {
    const stepId = fieldSteps.get(fieldKey);
    if (stepId === undefined || !reachedStepIds.has(stepId)) return false;
  }
  return true;
}

function split(rules: ValidationRule[]): TriggeredConsistency {
  return {
    errors: rules.filter((r) => r.severity === "error"),
    warnings: rules.filter((r) => r.severity === "warning"),
  };
}

function triggered(
  schema: PlaybookSchema,
  answers: Answers,
  reachedStepIds: ReadonlySet<string>,
  candidates: ValidationRule[],
): TriggeredConsistency {
  const fieldSteps = stepIdByFieldKey(schema, answers);
  return split(
    candidates.filter(
      (rule) =>
        // An empty `when` is an unfinished rule, not a rule that always
        // holds — evaluateConditionGroup({}) is true, so without this guard
        // every visitor would trip it. getPlaybookPublishIssues blocks these
        // at publish; this keeps a draft preview honest too.
        hasAnyCondition(rule.when) &&
        isEvaluable(rule, fieldSteps, reachedStepIds) &&
        evaluateConditionGroup(rule.when, answers),
    ),
  );
}

/**
 * Rules attached to one step, evaluated as the visitor leaves it.
 * `reachedStepIds` is every step whose questions have already been shown,
 * including the one being left.
 */
export function evaluateStepConsistency(
  schema: PlaybookSchema,
  answers: Answers,
  stepId: string,
  reachedStepIds: readonly string[],
): TriggeredConsistency {
  const candidates = schema.validationRules.filter(
    (rule) => rule.scope === "step" && rule.stepId === stepId,
  );
  if (candidates.length === 0) return NOTHING;
  return triggered(schema, answers, new Set(reachedStepIds), candidates);
}

/**
 * Every rule in the Playbook, evaluated once the whole journey has been
 * answered. Step-scoped rules are included deliberately: the step check is a
 * courtesy to the visitor, this one is the guarantee — a session that skipped
 * a step (a stale tab, a hand-written request) must not produce a Dossier the
 * Playbook says is impossible.
 */
export function evaluatePlaybookConsistency(
  schema: PlaybookSchema,
  answers: Answers,
): TriggeredConsistency {
  if (schema.validationRules.length === 0) return NOTHING;
  const reached = computeVisibleSteps(schema, answers).map((s) => s.step.id);
  return triggered(schema, answers, new Set(reached), schema.validationRules);
}

export interface ConsistencyGate {
  /** Whether the visitor may move on. */
  proceed: boolean;
  /** Rules to show as blocking. */
  errors: ValidationRule[];
  /** Warnings the visitor has not seen yet — showing them is what earns the next attempt. */
  newWarnings: ValidationRule[];
}

/**
 * What a triggered set means for the visitor trying to move forward.
 *
 * An error states a combination the Playbook says cannot exist, so it blocks
 * for as long as it holds. A warning is the expert saying "this is unusual" —
 * the visitor is entitled to read it and keep their answer anyway, so it
 * costs exactly one attempt and never more. That is the CLAUDE.md rule
 * applied to deterministic rules as much as to the AI: the system flags, the
 * human decides.
 *
 * Acknowledgement is by rule id and is meant to be kept for the whole
 * session: a visitor who has already dismissed a warning should not meet it
 * again on every later step.
 */
export function gateOnConsistency(
  rules: TriggeredConsistency,
  acknowledgedRuleIds: readonly string[],
): ConsistencyGate {
  if (rules.errors.length > 0) {
    return { proceed: false, errors: rules.errors, newWarnings: [] };
  }
  const newWarnings = rules.warnings.filter((rule) => !acknowledgedRuleIds.includes(rule.id));
  return { proceed: newWarnings.length === 0, errors: [], newWarnings };
}
