import type { AnswerValue, Answers, InspirationPhotoAnswer } from "@/build/schema/answers";
import { NOT_SURE_VALUE } from "@/build/schema/answers";
import type { DisplayPhotoReference, VisitorProjectSummary } from "@/build/schema/visitorSummary";
import type { PlaybookField } from "@/build/schema/playbook";
import type { VisibleStep } from "@/build/engine/validation";
import { formatAnswerForDisplay } from "@/build/engine/brief";

type CopyFn = (text: string) => string;

export type ProjectCanvasStatus = "confirmed" | "approximate" | "derived" | "clarify" | "neutral";

export interface ProjectCanvasItem {
  id: string;
  group: string;
  label: string;
  value: string;
  status: ProjectCanvasStatus;
}

function isBlank(value: AnswerValue | undefined): boolean {
  return value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
}

function hasNotSureOption(field: PlaybookField, value: AnswerValue | undefined): boolean {
  if (typeof value !== "string" || !("options" in field)) return false;
  return field.options.some((option) => option.value === value && option.isNotSure === true);
}

function groupForField(step: VisibleStep, field: PlaybookField): string {
  return field.briefMapping?.category ?? step.step.title;
}

function valueForCanvas(field: PlaybookField, value: AnswerValue, copy: CopyFn): string {
  if (value === NOT_SURE_VALUE || hasNotSureOption(field, value)) return copy("To clarify");
  if (field.type === "photo" && Array.isArray(value)) {
    return `${value.length} ${copy(value.length === 1 ? "photo attached" : "photos attached")}`;
  }
  if (
    field.type === "inspiration_photo" &&
    value &&
    typeof value === "object" &&
    "hypotheses" in value
  ) {
    const answer = value as InspirationPhotoAnswer;
    const parts = [
      answer.hypotheses.style,
      ...answer.hypotheses.materials,
      answer.hypotheses.shape,
      ...answer.hypotheses.elements,
    ].filter((part): part is string => Boolean(part));
    return parts.length > 0 ? parts.slice(0, 3).map(copy).join(", ") : copy("Image notes captured");
  }
  const formatted = formatAnswerForDisplay(field, value);
  return copy(formatted || "Captured");
}

function statusForRuntimeField(
  field: PlaybookField,
  value: AnswerValue | undefined,
): ProjectCanvasStatus {
  if (isBlank(value) || value === NOT_SURE_VALUE || hasNotSureOption(field, value))
    return "clarify";
  if (field.briefMapping?.section === "assumptionsAndCalculated") return "approximate";
  if (field.type === "inspiration_photo") {
    if (!value || typeof value !== "object" || !("confirmed" in value)) return "approximate";
    const confirmed = (value as InspirationPhotoAnswer).confirmed ?? {};
    return Object.values(confirmed).some(Boolean) ? "approximate" : "neutral";
  }
  return "neutral";
}

export function projectCanvasItemsFromRuntime(
  steps: VisibleStep[],
  answers: Answers,
  copy: CopyFn,
  reachedStepIndex: number,
): ProjectCanvasItem[] {
  const reachedSteps = steps.slice(0, Math.min(reachedStepIndex + 1, steps.length));
  const items: ProjectCanvasItem[] = [];

  for (const step of reachedSteps) {
    for (const field of step.visibleFields) {
      if (field.type === "consent") continue;
      const value = answers[field.key];
      const shouldShowClarifier =
        (isBlank(value) || value === NOT_SURE_VALUE || hasNotSureOption(field, value)) &&
        field.desirability !== "optional";
      if (isBlank(value) && !shouldShowClarifier) continue;
      items.push({
        id: `${step.step.id}-${field.key}`,
        group: copy(groupForField(step, field)),
        label: copy(field.briefMapping?.label ?? field.label),
        value: shouldShowClarifier
          ? copy("To clarify")
          : valueForCanvas(field, value as AnswerValue, copy),
        status: statusForRuntimeField(field, value),
      });
    }
  }

  return items;
}

export function projectCanvasItemsFromSummary(
  summary: Omit<VisitorProjectSummary, "photos"> & { photos: DisplayPhotoReference[] },
  copy: CopyFn,
): ProjectCanvasItem[] {
  return [
    ...summary.confirmedItems.map((item) => ({
      id: `confirmed-${item.label}-${item.value}`,
      group: copy("Project"),
      label: copy(item.label),
      value: copy(item.value),
      status: "confirmed" as const,
    })),
    ...summary.calculatedItems.map((item) => ({
      id: `derived-${item.label}-${item.value}`,
      group: copy("Derived"),
      label: copy(item.label),
      value: copy(item.value),
      status: "derived" as const,
    })),
    ...summary.budgetAndTimingItems.map((item) => ({
      id: `budget-${item.label}-${item.value}`,
      group: copy("Budget & timing"),
      label: copy(item.label),
      value: copy(item.value),
      status: "neutral" as const,
    })),
    ...summary.itemsToConfirm.map((item) => ({
      id: `clarify-${item.label}-${item.value}`,
      group: copy("To clarify"),
      label: copy(item.label),
      value: copy(item.value),
      status: "clarify" as const,
    })),
  ];
}
