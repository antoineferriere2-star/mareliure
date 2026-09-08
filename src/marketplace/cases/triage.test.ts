import { describe, expect, it } from "vitest";
import { buildCaseProfile } from "./caseProfile";
import { triageCase } from "./triage";

describe("triage decides what the marketplace does about what the Playbook found", () => {
  it("holds a book declared over 1 000 € for a human", () => {
    const triage = triageCase(buildCaseProfile({ valeurFinanciere: "gt_1000" }));
    expect(triage.manualReviewRequired).toBe(true);
    expect(triage.reasons.join(" ")).toContain("1 000 €");
    expect(triage.declaredValueBand).toBe("gt_1000");
  });

  it("holds a heritage book and says why, without claiming a diagnosis", () => {
    const triage = triageCase(buildCaseProfile({ nature: "livre_ancien" }));
    expect(triage.manualReviewRequired).toBe(true);
    expect(triage.heritageFlag).toBe(true);
    expect(triage.reasons.join(" ")).toContain("validation par un professionnel");
  });

  it("holds a book with suspected mould", () => {
    const triage = triageCase(buildCaseProfile({ etat: ["moisissure"] }));
    expect(triage.manualReviewRequired).toBe(true);
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
      reasons: [],
    });
  });

  it("gives every reason at once rather than stopping at the first", () => {
    const triage = triageCase(
      buildCaseProfile({
        nature: "manuscrit",
        valeurFinanciere: "gt_1000",
        etat: ["moisissure"],
      }),
    );
    expect(triage.reasons).toHaveLength(3);
  });

  it("does not hold a case merely because the value is unknown", () => {
    // Not knowing what a family bible is worth is the normal case. Holding
    // every such submission would make manual review meaningless.
    expect(
      triageCase(buildCaseProfile({ valeurFinanciere: "inconnue" })).manualReviewRequired,
    ).toBe(false);
  });
});
