import { describe, expect, it } from "vitest";
import { defaultDeckBrief } from "@/build/pages/public/defaultDeckBrief";
import type { MissionProposal } from "@/build/schema/missionProposal";
import { buildVisitorProjectSummary, extractPhotoReferences } from "./visitorSummary";

const proposal: MissionProposal = { confirmationText: "Thanks! We'll reach out within 24 hours." };

const baseOptions = {
  businessName: "Sanibel Decks",
  locale: "en-US" as const,
  measurementSystem: "imperial" as const,
  submittedAt: "2026-07-23T00:00:00.000Z",
};

function findItem(items: { label: string; value: string }[], label: string) {
  return items.find((i) => i.label === label);
}

describe("buildVisitorProjectSummary", () => {
  it("never leaks confidence or suggestedNextAction onto the visitor DTO", () => {
    const summary = buildVisitorProjectSummary(defaultDeckBrief, proposal, baseOptions);
    expect(summary).not.toHaveProperty("confidence");
    expect(summary).not.toHaveProperty("suggestedNextAction");
  });

  it("carries the version, locale, measurement system and business name through untouched", () => {
    const summary = buildVisitorProjectSummary(defaultDeckBrief, proposal, baseOptions);
    expect(summary.version).toBe(1);
    expect(summary.locale).toBe("en-US");
    expect(summary.measurementSystem).toBe("imperial");
    expect(summary.businessName).toBe("Sanibel Decks");
    expect(summary.summary).toBe(defaultDeckBrief.projectSummary);
    expect(summary.submittedAt).toBe("2026-07-23T00:00:00.000Z");
  });

  it("puts a real visitor answer in confirmedItems", () => {
    const summary = buildVisitorProjectSummary(defaultDeckBrief, proposal, baseOptions);
    expect(findItem(summary.confirmedItems, "Existing structure")?.value).toBe(
      "Existing wood deck",
    );
  });

  it("puts the calculated area in calculatedItems, not confirmedItems", () => {
    const summary = buildVisitorProjectSummary(defaultDeckBrief, proposal, baseOptions);
    expect(findItem(summary.calculatedItems, "Approximate area")?.value).toBe("252 sq ft");
    expect(findItem(summary.confirmedItems, "Approximate area")).toBeUndefined();
  });

  it("routes a constraint line by its own source rather than dropping it", () => {
    const summary = buildVisitorProjectSummary(defaultDeckBrief, proposal, baseOptions);
    const inConfirmed = findItem(summary.confirmedItems, "Access");
    const inCalculated = findItem(summary.calculatedItems, "Access");
    expect(inConfirmed ?? inCalculated).toBeDefined();
  });

  it("surfaces budget and timeline as their own list", () => {
    const summary = buildVisitorProjectSummary(defaultDeckBrief, proposal, baseOptions);
    expect(summary.budgetAndTimingItems.length).toBeGreaterThan(0);
  });

  it("passes through a configured confirmationText verbatim", () => {
    const summary = buildVisitorProjectSummary(defaultDeckBrief, proposal, baseOptions);
    expect(summary.confirmationText).toBe("Thanks! We'll reach out within 24 hours.");
  });

  it("returns null confirmationText when the workspace never configured one", () => {
    const summary = buildVisitorProjectSummary(defaultDeckBrief, {}, baseOptions);
    expect(summary.confirmationText).toBeNull();
  });

  it("treats a blank confirmationText the same as unset", () => {
    const summary = buildVisitorProjectSummary(
      defaultDeckBrief,
      { confirmationText: "   " },
      baseOptions,
    );
    expect(summary.confirmationText).toBeNull();
  });

  it("defaults photos to an empty array when the caller doesn't supply any", () => {
    const summary = buildVisitorProjectSummary(defaultDeckBrief, proposal, baseOptions);
    expect(summary.photos).toEqual([]);
  });

  it("passes through supplied photo references without inventing captions", () => {
    const summary = buildVisitorProjectSummary(defaultDeckBrief, proposal, {
      ...baseOptions,
      photos: [{ path: "workspace/photo1.jpg" }],
    });
    expect(summary.photos).toEqual([{ path: "workspace/photo1.jpg" }]);
  });

  it("never double-counts a line in both its bucket and itemsToConfirm", () => {
    const summary = buildVisitorProjectSummary(defaultDeckBrief, proposal, baseOptions);
    const confirmKeys = new Set(summary.itemsToConfirm.map((i) => `${i.label}|${i.value}`));
    for (const item of [
      ...summary.confirmedItems,
      ...summary.calculatedItems,
      ...summary.budgetAndTimingItems,
    ]) {
      expect(confirmKeys.has(`${item.label}|${item.value}`)).toBe(false);
    }
  });
});

describe("extractPhotoReferences", () => {
  it("collects the storage path from an inspiration photo answer", () => {
    const refs = extractPhotoReferences({
      inspirationPhoto: {
        photoPath: "workspace-1/session-1/photo.jpg",
        hypotheses: { materials: [], elements: [] },
        confirmed: {},
        suggestedQuestions: [],
      },
    });
    expect(refs).toEqual([{ path: "workspace-1/session-1/photo.jpg" }]);
  });

  it("ignores the plain multi-photo field, which has no storage path", () => {
    const refs = extractPhotoReferences({
      photos: [{ filename: "deck.jpg", sizeBytes: 1000, mimeType: "image/jpeg" }],
    });
    expect(refs).toEqual([]);
  });

  it("ignores unrelated string/number/boolean answers", () => {
    const refs = extractPhotoReferences({ length: 18, name: "Jane", consent: true });
    expect(refs).toEqual([]);
  });
});
