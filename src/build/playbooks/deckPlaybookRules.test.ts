// The Deck Playbook's armed consistency rules, exercised against the real
// schema rather than a fixture. A rule is data, so the only thing that can go
// wrong is the data: a value that no longer matches an option, a step id that
// was renamed, an `any`/`all` combination that reads differently from how it
// was meant. None of that is caught by types, and all of it is silent — the
// rule simply never fires and the trap stays disarmed.
import { describe, expect, it } from "vitest";
import { evaluateStepConsistency, evaluatePlaybookConsistency } from "@/build/engine/consistency";
import { getPlaybookPublishIssues } from "@/build/engine/validation";
import type { Answers } from "@/build/schema/answers";
import { deckPlaybookSchema } from "./deckPlaybookSchema";

/** Every step up to and including the one being left. */
const THROUGH_FEATURES = [
  "entryMode",
  "projectType",
  "property",
  "dimensions",
  "heightAccess",
  "materials",
  "features",
];

/** Enough answers for the fields the rules read to count as asked. */
function answers(overrides: Answers): Answers {
  return {
    entryMode: "I know what I want",
    projectType: "New deck",
    propertyType: "Single-family home",
    existingSituation: "No existing deck",
    desiredMaterial: "Composite",
    ...overrides,
  };
}

describe("a deck cannot be both ground-level and second-story", () => {
  it("blocks the step", () => {
    const result = evaluateStepConsistency(
      deckPlaybookSchema,
      answers({ heightAccess: ["Ground-level", "Second-story"] }),
      "heightAccess",
      ["entryMode", "projectType", "property", "dimensions", "heightAccess"],
    );
    expect(result.errors.map((r) => r.id)).toEqual(["deck-ground-and-second-story"]);
  });

  it("says nothing when only one is picked", () => {
    for (const pick of ["Ground-level", "Second-story", "Elevated"]) {
      const result = evaluateStepConsistency(
        deckPlaybookSchema,
        answers({ heightAccess: [pick] }),
        "heightAccess",
        ["entryMode", "projectType", "property", "dimensions", "heightAccess"],
      );
      expect(result.errors, `${pick} should not error`).toEqual([]);
    }
  });
});

describe("a raised deck with no stairs anywhere", () => {
  it("warns, and never blocks — being reached from inside is legitimate", () => {
    const result = evaluateStepConsistency(
      deckPlaybookSchema,
      answers({ heightAccess: ["Elevated"], features: ["Railing"] }),
      "features",
      THROUGH_FEATURES,
    );
    expect(result.errors).toEqual([]);
    expect(result.warnings.map((r) => r.id)).toContain("deck-elevated-without-stairs");
  });

  it("stays silent once stairs appear, from either field", () => {
    const viaAccess = evaluateStepConsistency(
      deckPlaybookSchema,
      answers({ heightAccess: ["Elevated", "Stairs required"], features: ["Stairs"] }),
      "features",
      THROUGH_FEATURES,
    );
    expect(viaAccess.warnings.map((r) => r.id)).not.toContain("deck-elevated-without-stairs");

    const viaFeatures = evaluateStepConsistency(
      deckPlaybookSchema,
      answers({ heightAccess: ["Elevated"], features: ["Stairs"] }),
      "features",
      THROUGH_FEATURES,
    );
    expect(viaFeatures.warnings.map((r) => r.id)).not.toContain("deck-elevated-without-stairs");
  });

  it("stays silent on a ground-level deck", () => {
    const result = evaluateStepConsistency(
      deckPlaybookSchema,
      answers({ heightAccess: ["Ground-level"], features: [] }),
      "features",
      THROUGH_FEATURES,
    );
    expect(result.warnings).toEqual([]);
  });
});

describe("the two places stairs can be answered", () => {
  it("warns when they disagree — the case the marketing example brief shows", () => {
    const result = evaluateStepConsistency(
      deckPlaybookSchema,
      answers({
        heightAccess: ["Elevated", "Stairs required"],
        features: ["Railing", "Lighting"],
      }),
      "features",
      THROUGH_FEATURES,
    );
    expect(result.warnings.map((r) => r.id)).toContain("deck-stairs-disagreement");
    expect(result.errors).toEqual([]);
  });

  it("stays silent when they agree", () => {
    const result = evaluateStepConsistency(
      deckPlaybookSchema,
      answers({ heightAccess: ["Elevated", "Stairs required"], features: ["Stairs"] }),
      "features",
      THROUGH_FEATURES,
    );
    expect(result.warnings).toEqual([]);
  });
});

describe("the rules as a set", () => {
  it("are all reachable — publish refuses a rule that can never fire", () => {
    const issues = getPlaybookPublishIssues(deckPlaybookSchema);
    expect(issues.filter((i) => i.includes("Validation rule"))).toEqual([]);
  });

  it("say nothing about a coherent project", () => {
    // The single most important case: a visitor who answered sensibly must
    // never be interrupted. A Vérificateur that cries wolf gets dismissed.
    const result = evaluatePlaybookConsistency(
      deckPlaybookSchema,
      answers({
        heightAccess: ["Elevated", "Stairs required"],
        features: ["Stairs", "Railing"],
        length: 20,
        width: 16,
      }),
    );
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});
