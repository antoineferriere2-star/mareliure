import { describe, expect, it } from "vitest";
import { BRIEF_SOURCE_LABELS, computeCompletionPercent, computeItemsToVerify } from "./briefLabels";
import type { ProjectBrief } from "./brief";

function makeBrief(overrides: Partial<ProjectBrief> = {}): ProjectBrief {
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    missionName: "Test",
    status: "Draft",
    projectSummary: "Test summary",
    confirmedInformation: [],
    assumptionsAndCalculated: [],
    constraints: [],
    missingInformation: [],
    budgetAndTiming: [],
    confidence: { score: 80, label: "high", reasons: [] },
    suggestedNextAction: { label: "Next", value: "Call", source: "deterministic_rule" },
    ...overrides,
  };
}

describe("BRIEF_SOURCE_LABELS", () => {
  it("never leaves a source value unmapped", () => {
    const sources: Array<keyof typeof BRIEF_SOURCE_LABELS> = [
      "visitor_answer",
      "calculated_value",
      "deterministic_rule",
      "assumed_default",
      "image_hypothesis",
    ];
    for (const source of sources) {
      expect(BRIEF_SOURCE_LABELS[source]).toBeTruthy();
      expect(BRIEF_SOURCE_LABELS[source]).not.toMatch(
        /^(visitor_answer|calculated_value|deterministic_rule|assumed_default|image_hypothesis)$/,
      );
    }
  });
});

describe("computeCompletionPercent", () => {
  it("returns 100 when nothing is expected yet", () => {
    expect(computeCompletionPercent(makeBrief())).toBe(100);
  });

  it("computes the ratio of confirmed vs missing", () => {
    const brief = makeBrief({
      confirmedInformation: [
        { label: "A", value: "1", source: "visitor_answer" },
        { label: "B", value: "2", source: "visitor_answer" },
        { label: "C", value: "3", source: "visitor_answer" },
      ],
      missingInformation: [{ label: "D", value: "?", source: "assumed_default" }],
    });
    expect(computeCompletionPercent(brief)).toBe(75);
  });
});

describe("computeItemsToVerify", () => {
  it("counts missing information", () => {
    const brief = makeBrief({
      missingInformation: [
        { label: "Permits", value: "unknown", source: "assumed_default" },
        { label: "Structural condition", value: "unknown", source: "assumed_default" },
      ],
    });
    expect(computeItemsToVerify(brief)).toBe(2);
  });

  it("also counts unconfirmed hypotheses found elsewhere in the brief", () => {
    const brief = makeBrief({
      missingInformation: [{ label: "Permits", value: "unknown", source: "assumed_default" }],
      assumptionsAndCalculated: [{ label: "Style", value: "Modern", source: "image_hypothesis" }],
      constraints: [{ label: "Access", value: "Limited", source: "deterministic_rule" }],
    });
    expect(computeItemsToVerify(brief)).toBe(2);
  });

  it("never double-counts the same line", () => {
    const brief = makeBrief({
      missingInformation: [{ label: "Permits", value: "unknown", source: "assumed_default" }],
    });
    expect(computeItemsToVerify(brief)).toBe(1);
  });
});
