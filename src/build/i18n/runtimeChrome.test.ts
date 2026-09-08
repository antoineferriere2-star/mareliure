// Coverage of the surface a visitor completing a Mission actually reads.
//
// A Mission running in French with an English "Continue" button is the kind of
// break nobody notices until a real visitor meets it: nothing throws, nothing
// logs, the page just reads half-translated. So the runtime's own vocabulary is
// enumerated in runtimeChrome.ts and asserted here, per locale that claims to
// cover it.
import { describe, expect, it } from "vitest";
import { publicCopy } from "@/build/pages/public/publicLocaleContext";
import { FR_PUBLIC_COPY } from "@/build/pages/public/frPublicCopy";
import {
  ALL_RUNTIME_STRINGS,
  RUNTIME_CHROME_STRINGS,
  RUNTIME_VALIDATION_TEMPLATES,
} from "./runtimeChrome";

/**
 * Words that are genuinely the same in French. Listed rather than inferred,
 * because "the output equals the input" is otherwise indistinguishable from a
 * missing entry — which is exactly the bug this file exists to catch.
 */
const IDENTICAL_IN_FRENCH = new Set(["Style"]);

describe("fr-FR covers the whole Guided Project Intake", () => {
  it.each(ALL_RUNTIME_STRINGS)("translates %j", (source) => {
    // Coverage is having an entry, not producing a different string: a word
    // like "Style" is correctly identical, and must not be mistaken for a gap.
    expect(FR_PUBLIC_COPY, `missing French for: ${source}`).toHaveProperty([source]);
    if (!IDENTICAL_IN_FRENCH.has(source)) {
      expect(publicCopy("fr-FR", source), source).not.toBe(source);
    }
  });

  it("keeps the placeholders the runtime splices back in", () => {
    // localizeValidationMessage masks the field label and any numbers out,
    // translates, then puts them back. A translation that drops {field} or
    // {n0} silently loses the very information the message exists to carry.
    for (const template of RUNTIME_VALIDATION_TEMPLATES) {
      const translated = FR_PUBLIC_COPY[template];
      expect(translated, template).toBeDefined();
      if (template.includes("{field}")) expect(translated).toContain("{field}");
      if (template.includes("{n0}")) expect(translated).toContain("{n0}");
    }
  });

  it("has no entry that is only the English string copied across", () => {
    // A placeholder entry copied from the source would satisfy the coverage
    // check above by existing, and read as English in production.
    for (const [source, translated] of Object.entries(FR_PUBLIC_COPY)) {
      if (IDENTICAL_IN_FRENCH.has(source)) continue;
      expect(translated, `untranslated entry: ${source}`).not.toBe(source);
    }
  });

  it("lists no string twice", () => {
    expect(new Set(ALL_RUNTIME_STRINGS).size).toBe(ALL_RUNTIME_STRINGS.length);
  });
});

describe("adding French changed nothing for the existing locales", () => {
  it("leaves en-US returning its own source text", () => {
    for (const source of ALL_RUNTIME_STRINGS) {
      expect(publicCopy("en-US", source)).toBe(source);
    }
  });

  it("still returns Spanish where Spanish exists", () => {
    // Sampled from ES_PUBLIC_COPY, which predates this change.
    expect(publicCopy("es-US", "Still to confirm")).toBe("Aún por confirmar");
    expect(publicCopy("es-US", "Loading…")).toBe("Cargando…");
    expect(publicCopy("es-US", "What happens next")).toBe("Qué sigue");
  });

  it("still falls back to the source for a string Spanish never covered", () => {
    const unknown = "A string no dictionary will ever contain — 4f9c1b";
    expect(publicCopy("es-US", unknown)).toBe(unknown);
    expect(publicCopy("fr-FR", unknown)).toBe(unknown);
  });

  it("does not offer French on Métré's own marketing site", async () => {
    // The engine supporting a locale and a surface offering it are different
    // statements. Adding fr-FR to the switcher would put a button on the SaaS
    // marketing pages that translates almost nothing.
    const { PUBLIC_LANGUAGE_OPTIONS } = await import("@/build/pages/public/publicLocaleContext");
    expect(PUBLIC_LANGUAGE_OPTIONS.map((o) => o.locale)).toEqual(["en-US", "es-US"]);
  });
});

describe("the runtime chrome list stays honest", () => {
  it("contains the strings the runtime is known to emit", () => {
    // Spot check: if someone empties the list, the coverage tests above pass
    // vacuously.
    expect(RUNTIME_CHROME_STRINGS).toContain("Continue");
    expect(RUNTIME_CHROME_STRINGS).toContain("Back");
    expect(RUNTIME_CHROME_STRINGS).toContain("Send my project");
    expect(RUNTIME_CHROME_STRINGS.length).toBeGreaterThan(50);
  });
});
