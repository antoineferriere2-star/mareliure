/**
 * The Playbook schema: this is where all business expertise lives (per
 * CLAUDE.md — components and the AI must never encode business rules
 * themselves). A Playbook is data; the generic engine in `src/build/engine/`
 * only interprets it.
 *
 * Structural validity (shapes/types) is enforced here via Zod. Semantic
 * "ready to publish" checks (unique field keys, dangling references, at
 * least one field...) live separately in `engine/validation.ts` so a draft
 * can be saved in an incomplete state while being authored.
 */
import { z } from "zod";

// ---------- Conditions (branching / conditional display) ----------

export const conditionOperator = z.enum([
  "equals",
  "not_equals",
  "includes",
  "not_includes",
  "is_empty",
  "is_not_empty",
  "greater_than",
  "less_than",
  "greater_or_equal",
  "less_or_equal",
]);
export type ConditionOperator = z.infer<typeof conditionOperator>;

export const condition = z.object({
  fieldKey: z.string().min(1),
  operator: conditionOperator,
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
});
export type Condition = z.infer<typeof condition>;

/** Absent group => always visible/true. `all` is AND, `any` is OR; both may be combined. */
export const conditionGroup = z.object({
  all: z.array(condition).optional(),
  any: z.array(condition).optional(),
});
export type ConditionGroup = z.infer<typeof conditionGroup>;

// ---------- Field options (choice-type fields) ----------

export const fieldOption = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  reassurance: z.string().optional(),
  isNotSure: z.boolean().optional(),
});
export type FieldOption = z.infer<typeof fieldOption>;

// ---------- Brief mapping (answer -> Dossier line) ----------

export const briefSectionKey = z.enum([
  "confirmedInformation",
  "assumptionsAndCalculated",
  "constraints",
  "missingInformation",
  "budgetAndTiming",
]);
export type BriefSectionKey = z.infer<typeof briefSectionKey>;

export const briefFieldMapping = z.object({
  section: briefSectionKey,
  label: z.string().min(1),
  category: z.string().optional(),
  format: z.enum(["raw", "join_comma", "option_label"]).default("raw"),
  includeIfEmpty: z.boolean().optional(),
});
export type BriefFieldMapping = z.infer<typeof briefFieldMapping>;

// ---------- Field base (shared by every field type) ----------

const fieldBase = {
  key: z.string().min(1),
  label: z.string().min(1),
  helpText: z.string().optional(),
  desirability: z.enum(["required", "recommended", "optional"]).default("optional"),
  missingMessage: z.string().optional(),
  allowNotSure: z.boolean().optional(),
  displayWhen: conditionGroup.optional(),
  briefMapping: briefFieldMapping.optional(),
};

// ---------- Per-type field definitions ----------

export const singleChoiceField = z.object({
  ...fieldBase,
  type: z.literal("single_choice"),
  options: z.array(fieldOption).min(1),
});

export const multiChoiceField = z.object({
  ...fieldBase,
  type: z.literal("multi_choice"),
  options: z.array(fieldOption).min(1),
  minSelected: z.number().int().nonnegative().optional(),
  maxSelected: z.number().int().positive().optional(),
});

export const textField = z.object({
  ...fieldBase,
  type: z.literal("text"),
  placeholder: z.string().optional(),
  multiline: z.boolean().optional(),
  minLength: z.number().int().nonnegative().optional(),
  maxLength: z.number().int().positive().optional(),
  pattern: z.string().optional(),
});

export const numberField = z.object({
  ...fieldBase,
  type: z.literal("number"),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().positive().optional(),
});

export const measurementUnit = z.enum(["ft", "in", "m", "cm", "sqft", "sqm"]);

export const measurementField = z.object({
  ...fieldBase,
  type: z.literal("measurement"),
  unit: measurementUnit,
  min: z.number().optional(),
  max: z.number().optional(),
});

export const budgetField = z.object({
  ...fieldBase,
  type: z.literal("budget"),
  currency: z.string().min(1).default("USD"),
  mode: z.enum(["ranges", "numeric"]),
  ranges: z.array(z.object({ value: z.string().min(1), label: z.string().min(1) })).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});

export const timelineField = z.object({
  ...fieldBase,
  type: z.literal("timeline"),
  options: z.array(fieldOption.extend({ urgency: z.enum(["high", "normal"]).optional() })).min(1),
});

export const addressComponentKey = z.enum(["zip", "city_state", "street", "country"]);

export const addressField = z.object({
  ...fieldBase,
  type: z.literal("address"),
  components: z.array(z.object({ key: addressComponentKey, label: z.string().min(1) })).min(1),
  requireAtLeastOne: z.boolean().optional(),
});

export const photoField = z.object({
  ...fieldBase,
  type: z.literal("photo"),
  maxFiles: z.number().int().positive(),
  maxFileSizeMb: z.number().positive(),
  acceptMimeTypes: z.array(z.string().min(1)).min(1),
  storage: z.enum(["filename_only", "supabase_storage"]).default("filename_only"),
});

export const coordinatesField = z.object({
  ...fieldBase,
  type: z.literal("coordinates"),
});

export const consentField = z.object({
  ...fieldBase,
  type: z.literal("consent"),
  consentText: z.string().min(1),
  desirability: z.literal("required").default("required"),
});

export const playbookField = z.discriminatedUnion("type", [
  singleChoiceField,
  multiChoiceField,
  textField,
  numberField,
  measurementField,
  budgetField,
  timelineField,
  addressField,
  photoField,
  coordinatesField,
  consentField,
]);
export type PlaybookField = z.infer<typeof playbookField>;
export type PlaybookFieldType = PlaybookField["type"];

export type SingleChoiceField = z.infer<typeof singleChoiceField>;
export type MultiChoiceField = z.infer<typeof multiChoiceField>;
export type TextField = z.infer<typeof textField>;
export type NumberField = z.infer<typeof numberField>;
export type MeasurementField = z.infer<typeof measurementField>;
export type BudgetField = z.infer<typeof budgetField>;
export type TimelineField = z.infer<typeof timelineField>;
export type AddressField = z.infer<typeof addressField>;
export type PhotoField = z.infer<typeof photoField>;
export type CoordinatesField = z.infer<typeof coordinatesField>;
export type ConsentField = z.infer<typeof consentField>;

// ---------- Steps / sections ----------

export const playbookStep = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  why: z.string().optional(),
  displayWhen: conditionGroup.optional(),
  fields: z.array(playbookField).default([]),
});
export type PlaybookStep = z.infer<typeof playbookStep>;

export const playbookSection = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  steps: z.array(playbookStep).default([]),
});
export type PlaybookSection = z.infer<typeof playbookSection>;

// ---------- Consistency rules (cross-field / cross-step) ----------

export const validationRule = z.object({
  id: z.string().min(1),
  scope: z.enum(["step", "playbook"]),
  stepId: z.string().optional(),
  /** Condition under which the rule is VIOLATED. */
  when: conditionGroup,
  message: z.string().min(1),
  severity: z.enum(["error", "warning"]),
});
export type ValidationRule = z.infer<typeof validationRule>;

// ---------- Brief generation config ----------

export const calculatedFieldCompute = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("multiply"),
    inputs: z.tuple([z.string().min(1), z.string().min(1)]),
    unit: z.string().optional(),
  }),
  z.object({
    op: z.literal("concat"),
    inputs: z.array(z.string().min(1)).min(1),
    separator: z.string().default(" "),
  }),
]);
export type CalculatedFieldCompute = z.infer<typeof calculatedFieldCompute>;

export const calculatedFieldMapping = z.object({
  key: z.string().min(1),
  compute: calculatedFieldCompute,
  fallbackFieldKey: z.string().optional(),
  section: briefSectionKey,
  label: z.string().min(1),
  category: z.string().optional(),
  onMissingLabel: z.string().optional(),
  onMissingValue: z.string().optional(),
});
export type CalculatedFieldMapping = z.infer<typeof calculatedFieldMapping>;

export const summaryFragment = z.object({
  template: z.string().min(1),
  when: conditionGroup.optional(),
});
export type SummaryFragment = z.infer<typeof summaryFragment>;

export const derivedLineRule = z.object({
  id: z.string().min(1),
  section: briefSectionKey,
  when: conditionGroup,
  label: z.string().min(1),
  value: z.string().min(1),
  source: z.enum(["deterministic_rule", "calculated_value", "visitor_answer"]).default("deterministic_rule"),
});
export type DerivedLineRule = z.infer<typeof derivedLineRule>;

export const alwaysIncludeLine = z.object({
  section: briefSectionKey,
  label: z.string().min(1),
  value: z.string().min(1),
  category: z.string().optional(),
});
export type AlwaysIncludeLine = z.infer<typeof alwaysIncludeLine>;

export const suggestedNextActionRule = z.object({
  when: conditionGroup.optional(),
  label: z.string().min(1),
  value: z.string().min(1),
});
export type SuggestedNextActionRule = z.infer<typeof suggestedNextActionRule>;

export const briefConfig = z.object({
  missionNameTemplate: z.string().optional(),
  statusLabel: z.string().optional(),
  summaryFragments: z.array(summaryFragment).default([]),
  emptySummaryFallback: z.string().default(""),
  calculatedFields: z.array(calculatedFieldMapping).default([]),
  derivedLines: z.array(derivedLineRule).default([]),
  alwaysIncludeLines: z.array(alwaysIncludeLine).default([]),
  suggestedNextActions: z.array(suggestedNextActionRule).default([]),
});
export type BriefConfig = z.infer<typeof briefConfig>;

// ---------- Root schema ----------

export const playbookSchema = z.object({
  schemaVersion: z.literal(1),
  sections: z.array(playbookSection).default([]),
  validationRules: z.array(validationRule).default([]),
  briefConfig: briefConfig.default({
    summaryFragments: [],
    emptySummaryFallback: "",
    calculatedFields: [],
    derivedLines: [],
    alwaysIncludeLines: [],
    suggestedNextActions: [],
  }),
});
export type PlaybookSchema = z.infer<typeof playbookSchema>;

export const emptyPlaybookSchema: PlaybookSchema = {
  schemaVersion: 1,
  sections: [],
  validationRules: [],
  briefConfig: {
    summaryFragments: [],
    emptySummaryFallback: "",
    calculatedFields: [],
    derivedLines: [],
    alwaysIncludeLines: [],
    suggestedNextActions: [],
  },
};
