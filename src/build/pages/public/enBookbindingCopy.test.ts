/**
 * Coverage guard, same idea as runtimeChrome.test.ts: walk every string the
 * live intake actually renders through `copy()` for the Bookbinding
 * Playbook, and fail if one has no English entry. A field added to
 * bookbindingPlaybookSchema.ts without a translation would otherwise show
 * French to a Fine Bindery customer, silently — no error, no visible bug in
 * French locales, just one sentence a reviewer has to notice by hand.
 */
import { describe, expect, it } from "vitest";
import { bookbindingPlaybookSchema } from "@/build/playbooks/bookbindingPlaybookSchema";
import type { PlaybookField } from "@/build/schema/playbook";
import { publicCopy } from "./publicLocaleContext";
import { EN_BOOKBINDING_COPY } from "./enBookbindingCopy";

/** Mirrors exactly what MissionRuntime's `localizeField` sends through `copy()`. */
function stringsFromField(field: PlaybookField): string[] {
  const strings: string[] = [field.label];
  if ("helpText" in field && typeof field.helpText === "string") strings.push(field.helpText);
  if ("consentText" in field && typeof field.consentText === "string")
    strings.push(field.consentText);
  if ("options" in field && Array.isArray(field.options)) {
    for (const option of field.options) {
      if (typeof option === "string") {
        strings.push(option);
      } else {
        strings.push(String(option.label));
        if ("reassurance" in option && typeof option.reassurance === "string")
          strings.push(option.reassurance);
      }
    }
  }
  if ("components" in field && Array.isArray(field.components)) {
    for (const component of field.components) strings.push(component.label);
  }
  if ("ranges" in field && Array.isArray(field.ranges)) {
    for (const range of field.ranges) strings.push(range.label);
  }
  return strings;
}

const RENDERED_STRINGS: string[] = [];
for (const section of bookbindingPlaybookSchema.sections) {
  for (const step of section.steps) {
    RENDERED_STRINGS.push(step.title);
    if (step.why) RENDERED_STRINGS.push(step.why);
    for (const field of step.fields) RENDERED_STRINGS.push(...stringsFromField(field));
  }
}

describe("EN_BOOKBINDING_COPY covers everything the live intake renders", () => {
  it.each([...new Set(RENDERED_STRINGS)])("translates %j", (text) => {
    expect(EN_BOOKBINDING_COPY[text], `Missing English translation for: ${text}`).toBeTypeOf(
      "string",
    );
  });

  it("leaves French untouched for fr-FR (Ma Reliure is unaffected)", () => {
    expect(publicCopy("fr-FR", "Que souhaitez-vous faire de votre livre ?")).toBe(
      "Que souhaitez-vous faire de votre livre ?",
    );
  });

  it("translates the same string to English for en-US (Fine Bindery)", () => {
    expect(publicCopy("en-US", "Que souhaitez-vous faire de votre livre ?")).toBe(
      "What would you like to do with your book?",
    );
  });

});

describe("the Vérificateur's messages with a number translate through the template, not the raw sentence", () => {
  it("covers both validation rules that mention a number", () => {
    const withNumbers = bookbindingPlaybookSchema.validationRules.filter((r) => /\d/.test(r.message));
    expect(withNumbers.map((r) => r.id).sort()).toEqual([
      "bookbinding-collector-budget-floor",
      "bookbinding-valuable-book-rushed",
    ]);
    for (const rule of withNumbers) {
      // Recomputed exactly as localizeValidationMessage does (MissionRuntime.tsx),
      // so a hand-typed template can never silently drift from the real regex.
      let count = 0;
      const realTemplate = rule.message.replace(/\d+/g, () => `{n${count++}}`);
      expect(
        EN_BOOKBINDING_COPY[realTemplate],
        `Missing template translation for: ${realTemplate}`,
      ).toBeTypeOf("string");
    }
  });

  it("the three number-free messages translate directly", () => {
    const withoutNumbers = bookbindingPlaybookSchema.validationRules.filter(
      (r) => !/\d/.test(r.message),
    );
    expect(withoutNumbers).toHaveLength(3);
    for (const rule of withoutNumbers) {
      expect(EN_BOOKBINDING_COPY[rule.message], `Missing translation for: ${rule.message}`).toBeTypeOf(
        "string",
      );
    }
  });
});
