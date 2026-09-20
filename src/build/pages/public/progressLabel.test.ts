import { describe, expect, it } from "vitest";
import type { IntakeProgress } from "@/build/engine/progress";
import { formatProgress } from "./progressLabel";
import { publicCopy } from "./publicLocaleContext";

const at = (overrides: Partial<IntakeProgress>): IntakeProgress => ({
  position: 3,
  total: 9,
  totalIsProvisional: false,
  remainingSeconds: 230,
  ...overrides,
});
const en = (text: string) => publicCopy("en-US", text);
const fr = (text: string) => publicCopy("fr-FR", text);
const es = (text: string) => publicCopy("es-US", text);

describe("formatProgress", () => {
  it("says position and time left, in each locale's own words", () => {
    expect(formatProgress(at({}), en)).toBe("Step 3 of 9 · About 4 min left");
    expect(formatProgress(at({}), fr)).toBe("Étape 3 sur 9 · Environ 4 min restantes");
    expect(formatProgress(at({}), es)).toBe("Paso 3 de 9 · Unos 4 min restantes");
  });

  it("does not state a total it cannot stand behind", () => {
    expect(formatProgress(at({ position: 1, total: 8, totalIsProvisional: true }), fr)).toBe(
      "Étape 1 sur au moins 8 · Environ 4 min restantes",
    );
    expect(formatProgress(at({ totalIsProvisional: true }), en)).toContain("of at least 9");
  });

  it("under a minute, does not pretend to count seconds", () => {
    expect(formatProgress(at({ position: 9, remainingSeconds: 40 }), fr)).toBe(
      "Étape 9 sur 9 · Moins d'une minute restante",
    );
  });

  it("never shows a percentage", () => {
    for (const locale of [en, fr, es]) {
      expect(formatProgress(at({}), locale)).not.toMatch(/%/);
    }
  });
});
