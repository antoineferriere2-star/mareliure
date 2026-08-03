import { describe, expect, it } from "vitest";
import { intakeAccessibleTitle } from "./intakeTitle";

describe("intakeAccessibleTitle", () => {
  it("appends the suffix to a plain commercial name", () => {
    expect(intakeAccessibleTitle("Happy Deck")).toBe("Happy Deck — Project Intake");
  });

  it("upgrades a trailing Intake instead of duplicating it", () => {
    expect(intakeAccessibleTitle("Deck Intake")).toBe("Deck Project Intake");
  });

  it("leaves a name that already ends in Project Intake untouched", () => {
    expect(intakeAccessibleTitle("Deck Project Intake")).toBe("Deck Project Intake");
  });

  it("adds no second suffix to a compound name ending in Intake", () => {
    // The regression that started this: "Happy Deck — Deck Intake project intake".
    expect(intakeAccessibleTitle("Happy Deck — Deck Intake")).toBe(
      "Happy Deck — Deck Project Intake",
    );
    expect(intakeAccessibleTitle("Happy Deck — Deck Intake")).not.toMatch(/intake.*intake/i);
  });

  describe("casing", () => {
    it.each([
      ["deck intake", "deck Project Intake"],
      ["DECK INTAKE", "DECK Project Intake"],
      ["Deck InTaKe", "Deck Project Intake"],
    ])("normalises the suffix of %s", (input, expected) => {
      expect(intakeAccessibleTitle(input)).toBe(expected);
    });

    it("keeps the author's own casing when the suffix is already there", () => {
      // Their wording is the commercial name; only the missing suffix is ours.
      expect(intakeAccessibleTitle("Deck project intake")).toBe("Deck project intake");
      expect(intakeAccessibleTitle("DECK PROJECT INTAKE")).toBe("DECK PROJECT INTAKE");
    });
  });

  describe("whitespace", () => {
    it("trims surrounding whitespace", () => {
      expect(intakeAccessibleTitle("  Happy Deck  ")).toBe("Happy Deck — Project Intake");
    });

    it("collapses internal runs of whitespace", () => {
      expect(intakeAccessibleTitle("Happy   Deck")).toBe("Happy Deck — Project Intake");
      expect(intakeAccessibleTitle("Deck \n Intake")).toBe("Deck Project Intake");
    });

    it("tolerates whitespace between the words of an existing suffix", () => {
      expect(intakeAccessibleTitle("Deck  Project   Intake")).toBe("Deck Project Intake");
    });
  });

  describe("edge cases", () => {
    it.each([undefined, null, "", "   "])("falls back to a usable title for %p", (input) => {
      expect(intakeAccessibleTitle(input)).toBe("Project Intake");
    });

    it("promotes a bare Intake to the full suffix", () => {
      expect(intakeAccessibleTitle("Intake")).toBe("Project Intake");
    });

    it("does not mangle a word that merely ends in the letters 'intake'", () => {
      // No word boundary before "intake" here, so the suffix is appended
      // rather than the word being cut in half.
      expect(intakeAccessibleTitle("Reintake")).toBe("Reintake — Project Intake");
    });

    it("treats a plural as a different word", () => {
      expect(intakeAccessibleTitle("Deck Intakes")).toBe("Deck Intakes — Project Intake");
    });

    it("is stable when applied twice", () => {
      const once = intakeAccessibleTitle("Happy Deck");
      expect(intakeAccessibleTitle(once)).toBe(once);
    });
  });
});
