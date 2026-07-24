/**
 * Pure validation + visibility engine — no framework dependency, shared by
 * client and server. This is the only place field-level and playbook-level
 * rules are interpreted; components and the API route never encode business
 * rules themselves (per CLAUDE.md).
 */
import { NOT_SURE_VALUE, type AnswerValue, type Answers } from "../schema/answers";
import type { ConditionGroup, PlaybookField, PlaybookSchema, PlaybookStep } from "../schema/playbook";
import { evaluateConditionGroup } from "./conditions";

function isEmpty(value: AnswerValue | undefined): boolean {
  if (value === undefined || value === null) return true;
  if (value === NOT_SURE_VALUE) return false;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).every(
      (v) => v === undefined || v === null || (typeof v === "string" && v.trim() === ""),
    );
  }
  return false;
}

/**
 * Type/format checks only (no required/empty handling) — used for partial
 * saves, where an interim empty value is fine but a malformed non-empty one
 * is not. `validateField` below layers required/not-sure handling on top for
 * final submit-time validation.
 */
export function validateFieldFormat(field: PlaybookField, value: AnswerValue): string | null {
  switch (field.type) {
    case "single_choice":
    case "timeline": {
      if (typeof value !== "string" || !field.options.some((o) => o.value === value)) {
        return `"${field.label}" has an invalid option.`;
      }
      return null;
    }
    case "multi_choice": {
      if (!Array.isArray(value)) return `"${field.label}" must be a list.`;
      const invalid = value.some((v) => typeof v !== "string" || !field.options.some((o) => o.value === v));
      if (invalid) return `"${field.label}" has an invalid option.`;
      if (field.minSelected !== undefined && value.length < field.minSelected) {
        return `"${field.label}" requires at least ${field.minSelected} selection(s).`;
      }
      if (field.maxSelected !== undefined && value.length > field.maxSelected) {
        return `"${field.label}" allows at most ${field.maxSelected} selection(s).`;
      }
      return null;
    }
    case "text": {
      if (typeof value !== "string") return `"${field.label}" must be text.`;
      if (field.minLength !== undefined && value.length < field.minLength) return `"${field.label}" is too short.`;
      if (field.maxLength !== undefined && value.length > field.maxLength) return `"${field.label}" is too long.`;
      if (field.pattern && !new RegExp(field.pattern).test(value)) return `"${field.label}" is not valid.`;
      return null;
    }
    case "number": {
      const n = typeof value === "number" ? value : Number.parseFloat(String(value));
      if (!Number.isFinite(n)) return `"${field.label}" must be a number.`;
      if (field.min !== undefined && n < field.min) return `"${field.label}" is below the minimum.`;
      if (field.max !== undefined && n > field.max) return `"${field.label}" is above the maximum.`;
      return null;
    }
    case "measurement": {
      const n = typeof value === "number" ? value : Number.parseFloat(String(value));
      if (!Number.isFinite(n)) return `"${field.label}" must be a number.`;
      if (field.min !== undefined && n < field.min) return `"${field.label}" is below the minimum.`;
      if (field.max !== undefined && n > field.max) return `"${field.label}" is above the maximum.`;
      return null;
    }
    case "budget": {
      if (field.mode === "ranges") {
        if (typeof value !== "string" || !(field.ranges ?? []).some((r) => r.value === value)) {
          return `"${field.label}" has an invalid range.`;
        }
        return null;
      }
      const n = typeof value === "number" ? value : Number.parseFloat(String(value));
      if (!Number.isFinite(n)) return `"${field.label}" must be a number.`;
      if (field.min !== undefined && n < field.min) return `"${field.label}" is below the minimum.`;
      if (field.max !== undefined && n > field.max) return `"${field.label}" is above the maximum.`;
      return null;
    }
    case "address": {
      if (typeof value !== "object" || Array.isArray(value)) return `"${field.label}" is invalid.`;
      const anyFilled = field.components.some((c) => {
        const v = (value as Record<string, unknown>)[c.key];
        return typeof v === "string" && v.trim().length > 0;
      });
      if (field.requireAtLeastOne && !anyFilled) return `"${field.label}" requires at least one value.`;
      return null;
    }
    case "photo": {
      if (!Array.isArray(value)) return `"${field.label}" must be a list of photos.`;
      if (value.length > field.maxFiles) return `"${field.label}" allows at most ${field.maxFiles} photo(s).`;
      const invalid = value.some((p) => {
        const photo = p as { mimeType?: string; sizeBytes?: number };
        if (!photo.mimeType || !field.acceptMimeTypes.includes(photo.mimeType)) return true;
        if (typeof photo.sizeBytes !== "number" || photo.sizeBytes > field.maxFileSizeMb * 1024 * 1024) return true;
        return false;
      });
      return invalid ? `"${field.label}" has an unsupported photo.` : null;
    }
    case "coordinates": {
      const v = value as { lat?: unknown; lng?: unknown };
      if (typeof v.lat !== "number" || typeof v.lng !== "number") return `"${field.label}" is invalid.`;
      return null;
    }
    case "consent":
      return value === true ? null : `"${field.label}" must be accepted.`;
    default:
      return null;
  }
}

/** Full validation (required + not-sure + format) — used for submit-time checks. */
export function validateField(field: PlaybookField, value: AnswerValue | undefined): string | null {
  if (value === NOT_SURE_VALUE) {
    return field.allowNotSure ? null : `"${field.label}" requires a specific answer.`;
  }
  if (isEmpty(value) || value === undefined) {
    return field.desirability === "required" ? `"${field.label}" is required.` : null;
  }
  return validateFieldFormat(field, value);
}

export interface VisibleStep {
  sectionId: string;
  sectionTitle: string;
  step: PlaybookStep;
  visibleFields: PlaybookField[];
}

/** Steps/fields whose displayWhen currently evaluates true. A step with no visible fields is skipped entirely. */
export function computeVisibleSteps(schema: PlaybookSchema, answers: Answers): VisibleStep[] {
  const result: VisibleStep[] = [];
  for (const section of schema.sections) {
    for (const step of section.steps) {
      if (!evaluateConditionGroup(step.displayWhen, answers)) continue;
      const visibleFields = step.fields.filter((f) => evaluateConditionGroup(f.displayWhen, answers));
      if (visibleFields.length === 0) continue;
      result.push({ sectionId: section.id, sectionTitle: section.title, step, visibleFields });
    }
  }
  return result;
}

/** Labels of currently-visible required fields that are empty or invalid — used for build_dossiers.next_questions. */
export function computeUnansweredRequiredFields(schema: PlaybookSchema, answers: Answers): string[] {
  const labels: string[] = [];
  for (const { visibleFields } of computeVisibleSteps(schema, answers)) {
    for (const field of visibleFields) {
      if (field.desirability !== "required") continue;
      if (validateField(field, answers[field.key])) labels.push(field.label);
    }
  }
  return labels;
}

function collectConditionFieldKeys(group: ConditionGroup | undefined): string[] {
  if (!group) return [];
  return [...(group.all ?? []), ...(group.any ?? [])].map((c) => c.fieldKey);
}

/**
 * Semantic "ready to publish" checks. Structural validity (shapes/types) is
 * already guaranteed by the Zod schema before this runs; this catches
 * dangling references and incompleteness that Zod can't express.
 */
export function getPlaybookPublishIssues(schema: PlaybookSchema): string[] {
  const issues: string[] = [];
  const allFields = schema.sections.flatMap((s) => s.steps.flatMap((st) => st.fields));

  if (allFields.length === 0) {
    issues.push("The playbook has no fields yet.");
  }

  const keys = allFields.map((f) => f.key);
  const duplicates = Array.from(new Set(keys.filter((k, i) => keys.indexOf(k) !== i)));
  if (duplicates.length > 0) {
    issues.push(`Duplicate field keys: ${duplicates.join(", ")}.`);
  }

  const knownKeys = new Set(keys);
  function checkRefs(group: ConditionGroup | undefined, where: string) {
    for (const fieldKey of collectConditionFieldKeys(group)) {
      if (!knownKeys.has(fieldKey)) issues.push(`${where} references unknown field "${fieldKey}".`);
    }
  }

  for (const section of schema.sections) {
    for (const step of section.steps) {
      checkRefs(step.displayWhen, `Step "${step.title}"`);
      for (const field of step.fields) {
        checkRefs(field.displayWhen, `Field "${field.label}"`);
      }
    }
  }
  for (const rule of schema.validationRules) {
    checkRefs(rule.when, `Validation rule "${rule.id}"`);
  }
  for (const calc of schema.briefConfig.calculatedFields) {
    for (const inputKey of calc.compute.inputs) {
      if (!knownKeys.has(inputKey)) issues.push(`Calculated field "${calc.key}" references unknown field "${inputKey}".`);
    }
    if (calc.fallbackFieldKey && !knownKeys.has(calc.fallbackFieldKey)) {
      issues.push(`Calculated field "${calc.key}" fallback references unknown field "${calc.fallbackFieldKey}".`);
    }
  }
  for (const line of schema.briefConfig.derivedLines) {
    checkRefs(line.when, `Derived line "${line.id}"`);
  }

  if (schema.briefConfig.suggestedNextActions.length === 0) {
    issues.push("At least one suggested next action is required.");
  } else if (!schema.briefConfig.suggestedNextActions.some((a) => !a.when)) {
    issues.push("At least one suggested next action must have no condition (used as the default).");
  }

  return issues;
}
