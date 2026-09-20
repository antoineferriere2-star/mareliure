/**
 * Honest progress for a Guided Project Intake.
 *
 * The bar used to say "Step 1 of 8 · 13% complete" before the visitor had
 * answered anything, then "Step 2 of 9" one click later: a Playbook shows or
 * hides whole steps depending on earlier answers, so the total moves, and a
 * percentage computed from it is a promise nobody can keep. This module says
 * only what is true:
 *
 * - the position (`Step 3 of 9`), and whether the total can still grow — a step
 *   that is hidden now but hangs on an answer the visitor has not given yet;
 * - a time left, estimated from the *kind* of question still to come (a photo
 *   costs more than a choice), never from the business the Playbook describes.
 *
 * Pure and generic: it reads the schema's shape (field types, conditions),
 * never a field key or a label.
 */
import type { Answers } from "@/build/schema/answers";
import type { PlaybookField, PlaybookFieldType, PlaybookSchema } from "@/build/schema/playbook";
import { collectConditionFieldKeys, evaluateConditionGroup } from "./conditions";
import { validateField, type VisibleStep } from "./validation";

/**
 * Seconds a visitor typically needs for one question of each kind. Deliberately
 * coarse: the output is rounded to whole minutes, so precision here would be
 * theatre. A measurement is dear because it means fetching a ruler; a photo
 * because it means picking up the book.
 */
export const FIELD_SECONDS: Record<PlaybookFieldType, number> = {
  single_choice: 8,
  multi_choice: 12,
  text: 20,
  number: 10,
  measurement: 25,
  budget: 8,
  timeline: 8,
  address: 40,
  photo: 60,
  coordinates: 15,
  inspiration_photo: 45,
  consent: 5,
};

/** Every step costs a moment of reading before the first answer. */
const STEP_OVERHEAD_SECONDS = 5;

/** A field the visitor is free to leave blank is, on average, half answered. */
const SKIPPABLE_WEIGHT = 0.5;

export function estimateFieldSeconds(field: PlaybookField): number {
  const base = FIELD_SECONDS[field.type];
  return field.desirability === "required" ? base : base * SKIPPABLE_WEIGHT;
}

export function estimateStepSeconds(step: VisibleStep): number {
  return (
    STEP_OVERHEAD_SECONDS +
    step.visibleFields.reduce((total, field) => total + estimateFieldSeconds(field), 0)
  );
}

function isBlank(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

/**
 * True when the number of steps can still go up: some step is hidden right now
 * and its visibility hangs on an answer the visitor has not given yet.
 *
 * A step hidden because the visitor answered the other way is *not*
 * provisional — that answer is on record and will not change unless the
 * visitor edits it, in which case the label follows.
 */
export function totalMayStillGrow(
  schema: PlaybookSchema,
  answers: Answers,
  visibleSteps: VisibleStep[],
): boolean {
  const shown = new Set(visibleSteps.map((entry) => entry.step.id));
  for (const section of schema.sections) {
    for (const step of section.steps) {
      if (shown.has(step.id)) continue;
      // The step's own condition decides first. If it hangs on an answer still
      // missing, the step may yet appear. If it is decided and false, the step
      // is out for good — whatever its fields' conditions say, they are never
      // reached (a hidden "finishes" step whose "number of ribs" field waits on
      // "finishes" is not a step that can come back).
      if (collectConditionFieldKeys(step.displayWhen).some((key) => isBlank(answers[key]))) {
        return true;
      }
      if (!evaluateConditionGroup(step.displayWhen, answers)) continue;
      // The step is allowed, yet hidden: every one of its fields is waiting on
      // an answer that is not there yet.
      for (const field of step.fields) {
        if (collectConditionFieldKeys(field.displayWhen).some((key) => isBlank(answers[key]))) {
          return true;
        }
      }
    }
  }
  return false;
}

export interface IntakeProgress {
  /** 1-based position of the step on screen. */
  position: number;
  /** Steps on the path as it stands. */
  total: number;
  /** The total can still grow: say "at least", never a fixed number. */
  totalIsProvisional: boolean;
  /** Estimated time left, this step included, in seconds. */
  remainingSeconds: number;
}

export function describeProgress(input: {
  schema: PlaybookSchema;
  answers: Answers;
  steps: VisibleStep[];
  index: number;
}): IntakeProgress {
  const { schema, answers, steps } = input;
  const index = Math.min(Math.max(input.index, 0), Math.max(steps.length - 1, 0));
  const remainingSeconds = steps
    .slice(index)
    .reduce((total, step) => total + estimateStepSeconds(step), 0);
  return {
    position: steps.length === 0 ? 0 : index + 1,
    total: steps.length,
    totalIsProvisional: totalMayStillGrow(schema, answers, steps),
    remainingSeconds,
  };
}

/**
 * Where a returning visitor should land: the first step that still has a
 * question the visitor must answer (or an answer that no longer holds), or the
 * last step when everything required is done — the recap is one click away and
 * nothing is left to fill.
 *
 * The session already restores the answers; without this the visitor came back
 * to the first screen and pressed Continue past every step they had finished.
 * Optional blanks do not count — `validateField` is silent about them — so a
 * visitor who deliberately skipped a step is not sent back to it.
 */
export function resumeStepIndex(steps: VisibleStep[], answers: Answers): number {
  const index = steps.findIndex((entry) =>
    entry.visibleFields.some((field) => validateField(field, answers[field.key]) !== null),
  );
  return index === -1 ? Math.max(steps.length - 1, 0) : index;
}

/**
 * Whole minutes to show, or null when it is under a minute. Rounded up: "about
 * 3 min" that turns out to be 3 min 20 is fine, the reverse is not.
 */
export function remainingMinutes(remainingSeconds: number): number | null {
  if (remainingSeconds < 60) return null;
  return Math.ceil(remainingSeconds / 60);
}
