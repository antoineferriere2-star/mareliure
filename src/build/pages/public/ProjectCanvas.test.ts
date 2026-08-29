import { describe, expect, it } from "vitest";
import { NOT_SURE_VALUE, type Answers } from "@/build/schema/answers";
import { deckPlaybookSchema } from "@/build/playbooks/deckPlaybookSchema";
import { computeVisibleSteps } from "@/build/engine/validation";
import {
  projectCanvasItemsFromRuntime,
  projectCanvasItemsFromSummary,
} from "./ProjectCanvasProjection";

const copy = (text: string) => text;

describe("ProjectCanvas projection", () => {
  it("builds runtime items from visible Playbook fields and answers", () => {
    const answers: Answers = {
      projectType: "New deck",
      propertyType: "Single-family home",
      desiredMaterial: NOT_SURE_VALUE,
    };
    const steps = computeVisibleSteps(deckPlaybookSchema, answers);

    const items = projectCanvasItemsFromRuntime(steps, answers, copy, 4);

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Project type",
          value: "New deck",
          status: "neutral",
        }),
        expect.objectContaining({
          label: "Height/access",
          value: "To clarify",
          status: "clarify",
        }),
      ]),
    );
  });

  it("preserves real summary provenance when the Visitor Project Summary has it", () => {
    const items = projectCanvasItemsFromSummary(
      {
        version: 1,
        locale: "en-US",
        measurementSystem: "imperial",
        businessName: "Northshore Outdoor",
        summary: "Project summary",
        confirmedItems: [{ label: "Project", value: "Replacement" }],
        calculatedItems: [{ label: "Approximate area", value: "252 sq ft" }],
        budgetAndTimingItems: [{ label: "Timeline", value: "Within 3 months" }],
        itemsToConfirm: [{ label: "Structural condition", value: "Not confirmed" }],
        photos: [],
        confirmationText: null,
        submittedAt: "2026-08-29T00:00:00.000Z",
      },
      copy,
    );

    expect(items.map((item) => [item.label, item.status])).toEqual([
      ["Project", "confirmed"],
      ["Approximate area", "derived"],
      ["Timeline", "neutral"],
      ["Structural condition", "clarify"],
    ]);
  });
});
