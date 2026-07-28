// Deterministic, pure expansion of the AI's deliberately simplified draft
// shape (see src/build/ai/playbookDraftGeneration.ts) into a full, valid
// PlaybookSchema. The AI only proposes step/field content — every
// structural detail that must be exactly right (ids, unique keys, brief
// mapping, a submittable contact step, a publishable briefConfig) is built
// here in code, never left to the model. This is the actual reliability
// guarantee: if this function's output fails playbookSchema.parse, that is
// a bug in this function, not a "bad AI response" to route around.
import {
  playbookSchema,
  type PlaybookField,
  type PlaybookSchema,
  type PlaybookStep,
} from "@/build/schema/playbook";
import { slugify, uniqueSlug } from "@/build/pages/admin/playbookEditor/slug";

export const GENERATABLE_FIELD_TYPES = [
  "single_choice",
  "multi_choice",
  "text",
  "number",
  "budget",
  "timeline",
  "address",
  "photo",
] as const;
export type GeneratableFieldType = (typeof GENERATABLE_FIELD_TYPES)[number];

export interface DraftField {
  label: string;
  type: GeneratableFieldType;
  required: boolean;
  options?: string[];
}

export interface DraftStep {
  title: string;
  why: string;
  fields: DraftField[];
}

export interface PlaybookDraft {
  steps: DraftStep[];
}

function toOption(label: string) {
  return { value: slugify(label), label };
}

const FALLBACK_CHOICE_OPTIONS = ["Not sure yet"];
const FALLBACK_BUDGET_RANGES = ["Under $1,000", "$1,000-$5,000", "$5,000+", "Not sure yet"];

function generatedBriefFormat(fieldType: GeneratableFieldType) {
  if (fieldType === "multi_choice") return "join_comma" as const;
  if (fieldType === "single_choice" || fieldType === "timeline" || fieldType === "budget") {
    return "option_label" as const;
  }
  return "raw" as const;
}

function expandField(field: DraftField, usedKeys: string[]): PlaybookField {
  const key = uniqueSlug(field.label, usedKeys);
  usedKeys.push(key);
  const desirability = field.required ? ("required" as const) : ("optional" as const);
  const isBudgetOrTimeline = field.type === "budget" || field.type === "timeline";
  const briefMapping = {
    section: isBudgetOrTimeline ? ("budgetAndTiming" as const) : ("confirmedInformation" as const),
    label: field.label,
    format: generatedBriefFormat(field.type),
  };

  switch (field.type) {
    case "single_choice":
    case "multi_choice": {
      const options = (
        field.options && field.options.length > 0 ? field.options : FALLBACK_CHOICE_OPTIONS
      ).map(toOption);
      return { key, label: field.label, type: field.type, desirability, options, briefMapping };
    }
    case "timeline": {
      const options = (
        field.options && field.options.length > 0 ? field.options : FALLBACK_CHOICE_OPTIONS
      ).map(toOption);
      return { key, label: field.label, type: "timeline", desirability, options, briefMapping };
    }
    case "text":
      return { key, label: field.label, type: "text", desirability, briefMapping };
    case "number":
      return { key, label: field.label, type: "number", desirability, briefMapping };
    case "budget": {
      const ranges = (
        field.options && field.options.length > 0 ? field.options : FALLBACK_BUDGET_RANGES
      ).map(toOption);
      return {
        key,
        label: field.label,
        type: "budget",
        desirability,
        currency: "USD",
        mode: "ranges",
        ranges,
        briefMapping,
      };
    }
    case "address":
      return {
        key,
        label: field.label,
        type: "address",
        desirability,
        components: [
          { key: "zip", label: "ZIP code" },
          { key: "city_state", label: "City / State" },
        ],
        requireAtLeastOne: true,
        briefMapping,
      };
    case "photo":
      return {
        key,
        label: field.label,
        type: "photo",
        desirability,
        maxFiles: 6,
        maxFileSizeMb: 8,
        acceptMimeTypes: ["image/jpeg", "image/png", "image/webp"],
        storage: "filename_only",
        briefMapping,
      };
  }
}

function buildContactStep(usedKeys: string[]): PlaybookStep {
  // Always hand-authored, never AI-generated — guarantees every generated
  // Playbook is actually submittable (a valid consent field, an email
  // pattern that matches validateFieldFormat's expectations).
  for (const key of ["name", "email", "phone", "consent"]) usedKeys.push(key);
  return {
    id: crypto.randomUUID(),
    title: "Contact details and consent",
    why: "The business needs permission to review and respond to the project request.",
    fields: [
      {
        key: "name",
        label: "Name",
        type: "text",
        desirability: "required",
        briefMapping: { section: "confirmedInformation", label: "Name", format: "raw" },
      },
      {
        key: "email",
        label: "Email",
        type: "text",
        desirability: "required",
        pattern: "^\\S+@\\S+\\.\\S+$",
        briefMapping: { section: "confirmedInformation", label: "Email", format: "raw" },
      },
      {
        key: "phone",
        label: "Phone",
        type: "text",
        desirability: "recommended",
        missingMessage: "Phone number was not provided.",
        briefMapping: { section: "confirmedInformation", label: "Phone", format: "raw" },
      },
      {
        key: "consent",
        label: "I consent to sharing this request for review and follow-up.",
        type: "consent",
        desirability: "required",
        consentText: "I consent to sharing this request for review and follow-up.",
      },
    ],
  };
}

export function expandPlaybookDraft(
  draft: PlaybookDraft,
  businessType: string,
  product: string,
): PlaybookSchema {
  const usedKeys: string[] = [];
  // Reserve the contact step's keys first so an AI-generated field that
  // happens to be labeled e.g. "Email" gets suffixed instead of colliding.
  const contactStep = buildContactStep(usedKeys);

  const generatedSteps: PlaybookStep[] = draft.steps.map((step) => ({
    id: crypto.randomUUID(),
    title: step.title,
    why: step.why,
    fields: step.fields.map((field) => expandField(field, usedKeys)),
  }));

  const raw = {
    schemaVersion: 1 as const,
    sections: [
      {
        id: crypto.randomUUID(),
        title: `${product} intake`,
        steps: [...generatedSteps, contactStep],
      },
    ],
    validationRules: [],
    briefConfig: {
      emptySummaryFallback: `New ${businessType} inquiry: ${product}.`,
      summaryFragments: [],
      calculatedFields: [],
      derivedLines: [],
      alwaysIncludeLines: [],
      suggestedNextActions: [
        { label: "Suggested next action", value: "Review this project with the visitor directly." },
      ],
    },
  };

  return playbookSchema.parse(raw);
}
