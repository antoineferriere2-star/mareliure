import { describe, expect, it } from "vitest";
import { buildCaseProfile } from "./caseProfile";
import { TRIAGE_FLAG_MESSAGES, triageCase, triageMessages } from "./triage";

describe("triage decides what the marketplace does about what the Playbook found", () => {
  it("holds a book declared over 1 000 € for a human", () => {
    const triage = triageCase(buildCaseProfile({ valeurFinanciere: "gt_1000" }));
    expect(triage.manualReviewRequired).toBe(true);
    expect(triage.flags).toEqual(["declared_value_over_1000"]);
    expect(triage.declaredValueBand).toBe("over_1000");
  });

  it("holds a heritage book", () => {
    const triage = triageCase(buildCaseProfile({ nature: "livre_ancien" }));
    expect(triage.manualReviewRequired).toBe(true);
    expect(triage.heritageFlag).toBe(true);
    expect(triage.flags).toEqual(["heritage_book"]);
  });

  it("holds a book with suspected mould", () => {
    const triage = triageCase(buildCaseProfile({ etat: ["moisissure"] }));
    expect(triage.manualReviewRequired).toBe(true);
    expect(triage.flags).toEqual(["suspected_mould"]);
  });

  it("lets an ordinary project through untouched", () => {
    const triage = triageCase(
      buildCaseProfile({
        intention: "belle_reliure",
        nature: "livre_courant",
        etat: ["couverture_usee"],
        valeurFinanciere: "100_500",
      }),
    );
    expect(triage).toEqual({
      manualReviewRequired: false,
      heritageFlag: false,
      declaredValueBand: "100_500",
      flags: [],
    });
  });

  it("gives every flag at once rather than stopping at the first", () => {
    const triage = triageCase(
      buildCaseProfile({
        nature: "manuscrit",
        valeurFinanciere: "gt_1000",
        etat: ["moisissure"],
      }),
    );
    expect(triage.flags).toEqual(["declared_value_over_1000", "heritage_book", "suspected_mould"]);
  });

  it("does not hold a case merely because the value is unknown", () => {
    // Not knowing what a family bible is worth is the normal case. Holding
    // every such submission would make manual review meaningless.
    const triage = triageCase(buildCaseProfile({ valeurFinanciere: "inconnue" }));
    expect(triage.manualReviewRequired).toBe(false);
    expect(triage.declaredValueBand).toBe("unknown");
  });

  it("treats an answer it has never seen as unknown, never as low-value", () => {
    // A Playbook may add a band before the marketplace decides what it means.
    // Falling back to "under_100" would silently let it past manual review.
    expect(buildCaseProfile({ valeurFinanciere: "un_nouveau_palier" }).declaredValueBand).toBe(
      "unknown",
    );
  });
});

describe("flags are codes, and the French is only a rendering of them", () => {
  it("stores codes, never sentences", () => {
    const triage = triageCase(buildCaseProfile({ valeurFinanciere: "gt_1000" }));
    for (const flag of triage.flags) {
      expect(flag).toMatch(/^[a-z0-9_]+$/);
    }
  });

  it("renders the sentences an admin reads from those codes", () => {
    expect(triageMessages(["declared_value_over_1000"])).toEqual([
      TRIAGE_FLAG_MESSAGES.declared_value_over_1000,
    ]);
  });

  it("ignores a stored code it does not recognise instead of showing it raw", () => {
    // An older row, or a flag removed from the product, must not surface as
    // `some_old_flag` in front of an admin.
    expect(triageMessages(["some_old_flag", "heritage_book"])).toEqual([
      TRIAGE_FLAG_MESSAGES.heritage_book,
    ]);
  });
});
