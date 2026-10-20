import { describe, expect, it } from "vitest";
import { defaultDeckBrief } from "@/build/pages/public/defaultDeckBrief";
import type { MissionProposal } from "@/build/schema/missionProposal";
import { buildVisitorProjectSummary, extractPhotoReferences, foreignPhotoReference } from "./visitorSummary";

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
    expect(findItem(summary.confirmedItems, "Existing situation")?.value).toBe(
      "Existing wood deck",
    );
  });

  it("does not duplicate the existing-site-condition answer under a second label", () => {
    const summary = buildVisitorProjectSummary(defaultDeckBrief, proposal, baseOptions);
    expect(findItem(summary.confirmedItems, "Existing structure")).toBeUndefined();
    expect(
      [...summary.confirmedItems, ...summary.calculatedItems, ...summary.itemsToConfirm].filter(
        (item) => item.value === "Existing wood deck",
      ),
    ).toHaveLength(1);
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

describe("buildVisitorProjectSummary — Spanish locale", () => {
  it("translates a confirmed item's label and value using the shared ES dictionary", () => {
    const summary = buildVisitorProjectSummary(defaultDeckBrief, proposal, {
      ...baseOptions,
      locale: "es-US",
    });
    expect(findItem(summary.confirmedItems, "Situación existente")?.value).toBe(
      "Terraza de madera existente",
    );
    // The untranslated English pair must not also be present.
    expect(findItem(summary.confirmedItems, "Existing situation")).toBeUndefined();
  });

  it("translates a calculated item's fixed label (value with a per-submission number stays as-is)", () => {
    const summary = buildVisitorProjectSummary(defaultDeckBrief, proposal, {
      ...baseOptions,
      locale: "es-US",
    });
    expect(findItem(summary.calculatedItems, "Área aproximada")).toBeDefined();
  });

  it("leaves content untranslated for the default English locale", () => {
    const summary = buildVisitorProjectSummary(defaultDeckBrief, proposal, baseOptions);
    expect(findItem(summary.confirmedItems, "Existing situation")?.value).toBe(
      "Existing wood deck",
    );
  });
});

describe("extractPhotoReferences", () => {
  const session = "11111111-1111-4111-8111-111111111111";
  const other = "22222222-2222-4222-8222-222222222222";
  const file = "33333333-3333-4333-8333-333333333333";
  const inspiration = (photoPath: string) => ({ photoPath, hypotheses: { materials: [], elements: [] }, confirmed: {}, suggestedQuestions: [] });

  it("collects the storage path from an inspiration photo answer of this session", () => {
    const refs = extractPhotoReferences({ inspirationPhoto: inspiration(`sessions/${session}/${file}.jpg`) }, session);
    expect(refs).toEqual([{ path: `sessions/${session}/${file}.jpg` }]);
  });

  it("collects uploaded project photos of this session, in the project bucket", () => {
    const refs = extractPhotoReferences({ photos: [{ filename: "dos.jpg", storagePath: `sessions/${session}/${file}`, mimeType: "image/jpeg", sizeBytes: 10 }] }, session);
    expect(refs).toEqual([{ path: `sessions/${session}/${file}`, caption: "dos.jpg", bucket: "build-project-photos" }]);
  });

  // Audit sécurité du 16 octobre 2026, P1 : une référence d'une autre session ne doit jamais être signée.
  it("drops a path from another session, an invented path and a path hidden in an extra answer", () => {
    // Valeurs falsifiées par le visiteur : hors du type Answers, d'où la conversion.
    const refs = extractPhotoReferences(({
      photos: [{ filename: "x.jpg", storagePath: `sessions/${other}/${file}`, mimeType: "image/jpeg", sizeBytes: 10 }],
      inspirationPhoto: inspiration("workspace-1/session-1/photo.jpg"),
      _extra: { photoPath: `sessions/${other}/${file}.png` },
      traversal: [{ storagePath: `sessions/${session}/../${other}/${file}` }],
    }) as never, session);
    expect(refs).toEqual([]);
  });

  it("returns nothing without a session", () => {
    expect(extractPhotoReferences({ inspirationPhoto: inspiration(`sessions/${session}/${file}.jpg`) }, null)).toEqual([]);
  });

  it("ignores the plain multi-photo field, which has no storage path", () => {
    const refs = extractPhotoReferences({ photos: [{ filename: "deck.jpg", sizeBytes: 1000, mimeType: "image/jpeg" }] }, session);
    expect(refs).toEqual([]);
  });

  it("ignores unrelated string/number/boolean answers", () => {
    expect(extractPhotoReferences({ length: 18, name: "Jane", consent: true }, session)).toEqual([]);
  });
});

describe("foreignPhotoReference", () => {
  const session = "11111111-1111-4111-8111-111111111111";
  it("flags any photo path this session did not upload, and only those", () => {
    expect(foreignPhotoReference([{ storagePath: `sessions/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333` }], session)).toBe(true);
    expect(foreignPhotoReference({ photoPath: "workspace-1/session-1/photo.jpg" }, session)).toBe(true);
    expect(foreignPhotoReference([{ storagePath: `sessions/${session}/33333333-3333-4333-8333-333333333333` }], session)).toBe(false);
    expect(foreignPhotoReference({ photoPath: `sessions/${session}/33333333-3333-4333-8333-333333333333.webp` }, session)).toBe(false);
    expect(foreignPhotoReference([{ filename: "a.jpg" }], session)).toBe(false);
    expect(foreignPhotoReference("text", session)).toBe(false);
  });
});
