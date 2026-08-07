import { describe, expect, it } from "vitest";
import {
  evaluatePlaybookConsistency,
  evaluateStepConsistency,
  gateOnConsistency,
} from "./consistency";
import type { PlaybookSchema, ValidationRule } from "../schema/playbook";

/**
 * A two-step Playbook standing in for a real trade rule: the visitor states a
 * deck height on step 1 and picks features on step 2. "Elevated but no
 * stairs" is the kind of trap only the expert knows to arm.
 */
function schemaWith(rules: ValidationRule[], overrides: Partial<PlaybookSchema> = {}) {
  return {
    schemaVersion: 1,
    sections: [
      {
        id: "sec",
        title: "Project",
        steps: [
          {
            id: "step-height",
            title: "Height",
            fields: [
              {
                key: "height",
                label: "Height",
                type: "single_choice",
                desirability: "required",
                options: [
                  { value: "ground", label: "Ground level" },
                  { value: "elevated", label: "Elevated" },
                ],
              },
            ],
          },
          {
            id: "step-features",
            title: "Features",
            fields: [
              {
                key: "features",
                label: "Features",
                type: "multi_choice",
                desirability: "optional",
                options: [
                  { value: "stairs", label: "Stairs" },
                  { value: "railing", label: "Railing" },
                ],
              },
            ],
          },
        ],
      },
    ],
    validationRules: rules,
    briefConfig: {
      summaryFragments: [],
      emptySummaryFallback: "",
      calculatedFields: [],
      derivedLines: [],
      alwaysIncludeLines: [],
      suggestedNextActions: [],
    },
    ...overrides,
  } as PlaybookSchema;
}

const noStairsOnElevated: ValidationRule = {
  id: "elevated-needs-stairs",
  scope: "step",
  stepId: "step-features",
  severity: "error",
  message: "An elevated deck needs stairs.",
  when: {
    all: [
      { fieldKey: "height", operator: "equals", value: "elevated" },
      { fieldKey: "features", operator: "not_includes", value: "stairs" },
    ],
  },
};

const bothSteps = ["step-height", "step-features"];

describe("evaluateStepConsistency", () => {
  it("raises the rule attached to the step when the answers trip it", () => {
    const result = evaluateStepConsistency(
      schemaWith([noStairsOnElevated]),
      { height: "elevated", features: ["railing"] },
      "step-features",
      bothSteps,
    );
    expect(result.errors.map((r) => r.id)).toEqual(["elevated-needs-stairs"]);
    expect(result.warnings).toEqual([]);
  });

  it("stays silent when the answers are consistent", () => {
    const result = evaluateStepConsistency(
      schemaWith([noStairsOnElevated]),
      { height: "elevated", features: ["stairs"] },
      "step-features",
      bothSteps,
    );
    expect(result.errors).toEqual([]);
  });

  it("separates errors from warnings", () => {
    const warn: ValidationRule = { ...noStairsOnElevated, id: "warn", severity: "warning" };
    const result = evaluateStepConsistency(
      schemaWith([noStairsOnElevated, warn]),
      { height: "elevated", features: [] },
      "step-features",
      bothSteps,
    );
    expect(result.errors.map((r) => r.id)).toEqual(["elevated-needs-stairs"]);
    expect(result.warnings.map((r) => r.id)).toEqual(["warn"]);
  });

  it("only considers rules attached to the step being left", () => {
    const elsewhere: ValidationRule = { ...noStairsOnElevated, stepId: "step-height" };
    const result = evaluateStepConsistency(
      schemaWith([elsewhere]),
      { height: "elevated", features: [] },
      "step-features",
      bothSteps,
    );
    expect(result.errors).toEqual([]);
  });

  it("ignores playbook-scoped rules — those are judged at submit", () => {
    const wide: ValidationRule = { ...noStairsOnElevated, scope: "playbook", stepId: undefined };
    const result = evaluateStepConsistency(
      schemaWith([wide]),
      { height: "elevated", features: [] },
      "step-features",
      bothSteps,
    );
    expect(result.errors).toEqual([]);
  });

  it("does not fire on a question the visitor has not reached yet", () => {
    // The features step is where the rule lives, but suppose it were checked
    // from the height step: `features` is empty only because it has not been
    // asked, which is not a contradiction.
    const early: ValidationRule = { ...noStairsOnElevated, stepId: "step-height" };
    const result = evaluateStepConsistency(
      schemaWith([early]),
      { height: "elevated" },
      "step-height",
      ["step-height"],
    );
    expect(result.errors).toEqual([]);
  });

  it("treats a rule with no condition as unfinished, not as always true", () => {
    // evaluateConditionGroup({}) is true — without the guard this rule would
    // fire for every visitor, and the editor default creates exactly this shape.
    const blank: ValidationRule = { ...noStairsOnElevated, when: {} };
    const result = evaluateStepConsistency(schemaWith([blank]), {}, "step-features", bothSteps);
    expect(result.errors).toEqual([]);
  });

  it("ignores a rule reading a field that no step asks", () => {
    const dangling: ValidationRule = {
      ...noStairsOnElevated,
      when: { all: [{ fieldKey: "permit", operator: "is_empty" }] },
    };
    const result = evaluateStepConsistency(schemaWith([dangling]), {}, "step-features", bothSteps);
    expect(result.errors).toEqual([]);
  });

  it("ignores a rule whose field is hidden from this visitor's journey", () => {
    // `features` only shows for elevated decks. For a ground-level visitor the
    // question is never asked, so its emptiness is the Playbook's branching
    // decision — not something to raise against the visitor.
    const schema = schemaWith([noStairsOnElevated]);
    schema.sections[0].steps[1].displayWhen = {
      all: [{ fieldKey: "height", operator: "equals", value: "elevated" }],
    };
    const result = evaluateStepConsistency(
      schema,
      { height: "ground" },
      "step-features",
      bothSteps,
    );
    expect(result.errors).toEqual([]);
  });
});

describe("evaluatePlaybookConsistency", () => {
  it("judges step-scoped rules too — a skipped step must not produce a Dossier the Playbook forbids", () => {
    const result = evaluatePlaybookConsistency(schemaWith([noStairsOnElevated]), {
      height: "elevated",
      features: [],
    });
    expect(result.errors.map((r) => r.id)).toEqual(["elevated-needs-stairs"]);
  });

  it("judges playbook-scoped rules that no single step could check", () => {
    const wide: ValidationRule = {
      id: "wide",
      scope: "playbook",
      severity: "warning",
      message: "Elevated deck with no features selected.",
      when: {
        all: [
          { fieldKey: "height", operator: "equals", value: "elevated" },
          { fieldKey: "features", operator: "is_empty" },
        ],
      },
    };
    const result = evaluatePlaybookConsistency(schemaWith([wide]), { height: "elevated" });
    expect(result.warnings.map((r) => r.message)).toEqual([
      "Elevated deck with no features selected.",
    ]);
  });

  it("returns nothing for a Playbook with no rules", () => {
    expect(evaluatePlaybookConsistency(schemaWith([]), { height: "elevated" })).toEqual({
      errors: [],
      warnings: [],
    });
  });
});

describe("gateOnConsistency", () => {
  const warn: ValidationRule = { ...noStairsOnElevated, id: "warn", severity: "warning" };

  it("lets the visitor through when nothing triggered", () => {
    expect(gateOnConsistency({ errors: [], warnings: [] }, [])).toEqual({
      proceed: true,
      errors: [],
      newWarnings: [],
    });
  });

  it("an error blocks however many times it is met", () => {
    const rules = { errors: [noStairsOnElevated], warnings: [] };
    const first = gateOnConsistency(rules, []);
    expect(first.proceed).toBe(false);
    expect(first.errors).toEqual([noStairsOnElevated]);
    // Acknowledging an error means nothing — only fixing the answers clears it.
    expect(gateOnConsistency(rules, ["elevated-needs-stairs"]).proceed).toBe(false);
  });

  it("a warning costs exactly one attempt: shown first, then passed", () => {
    const rules = { errors: [], warnings: [warn] };
    const first = gateOnConsistency(rules, []);
    expect(first.proceed).toBe(false);
    expect(first.newWarnings.map((r) => r.id)).toEqual(["warn"]);
    expect(gateOnConsistency(rules, ["warn"]).proceed).toBe(true);
  });

  it("an error hides warnings — the visitor fixes the blocker first", () => {
    const gate = gateOnConsistency({ errors: [noStairsOnElevated], warnings: [warn] }, []);
    expect(gate.newWarnings).toEqual([]);
  });

  it("a warning that appears after an earlier one was dismissed still gets its own attempt", () => {
    const later: ValidationRule = { ...warn, id: "later" };
    const gate = gateOnConsistency({ errors: [], warnings: [warn, later] }, ["warn"]);
    expect(gate.proceed).toBe(false);
    expect(gate.newWarnings.map((r) => r.id)).toEqual(["later"]);
  });
});
