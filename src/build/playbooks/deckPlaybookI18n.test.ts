// Regression guard for the "How would you like to start?" / "High" class of
// bug: the Deck Playbook is the actual data a Spanish-speaking visitor sees
// while going through the Guided Project Intake and Project Brief. copy()
// silently falls back to raw English when a key is missing from
// ES_PUBLIC_COPY, so a missing translation never fails loudly on its own —
// this test walks every visitor-facing string in the schema and asserts a
// Spanish entry exists for it.
import { describe, expect, it } from "vitest";
import { deckPlaybookSchema } from "./deckPlaybookSchema";
import { ES_PUBLIC_COPY } from "@/build/pages/public/publicLocaleContext";
import type { PlaybookField } from "@/build/schema/playbook";

function fieldStrings(field: PlaybookField): string[] {
  const strings: string[] = [field.label];
  if (field.helpText) strings.push(field.helpText);
  if (field.missingMessage) strings.push(field.missingMessage);
  if (field.type === "text" && field.placeholder) strings.push(field.placeholder);
  if (field.type === "consent") strings.push(field.consentText);
  if (
    field.type === "single_choice" ||
    field.type === "multi_choice" ||
    field.type === "timeline"
  ) {
    strings.push(...field.options.map((option) => option.label));
  }
  if (field.type === "budget" && field.ranges) {
    strings.push(...field.ranges.map((range) => range.label));
  }
  if (field.type === "address") {
    strings.push(...field.components.map((component) => component.label));
  }
  return strings;
}

function collectTranslatableStrings(): string[] {
  const strings: string[] = [];

  for (const section of deckPlaybookSchema.sections) {
    for (const step of section.steps) {
      strings.push(step.title);
      if (step.why) strings.push(step.why);
      for (const field of step.fields) {
        strings.push(...fieldStrings(field));
      }
    }
  }

  // A consistency rule's message is shown to the visitor mid-journey, so it
  // belongs here as much as any label does. It was not covered when the rules
  // were armed, which is exactly the silent-fallback this file exists to stop.
  for (const rule of deckPlaybookSchema.validationRules) {
    strings.push(rule.message);
  }

  const { briefConfig } = deckPlaybookSchema;
  if (briefConfig.statusLabel) strings.push(briefConfig.statusLabel);
  if (briefConfig.emptySummaryFallback) strings.push(briefConfig.emptySummaryFallback);
  for (const calculated of briefConfig.calculatedFields) {
    strings.push(calculated.label);
    if (calculated.onMissingLabel) strings.push(calculated.onMissingLabel);
    if (calculated.onMissingValue) strings.push(calculated.onMissingValue);
  }
  for (const derived of briefConfig.derivedLines) {
    strings.push(derived.label);
    // Mustache interpolations (e.g. "{{existingSituation}}") echo back the
    // visitor's own raw answer text at render time — that's a separate,
    // larger problem (translating arbitrary visitor-authored content), not
    // a missing dictionary entry here.
    if (!derived.value.includes("{{")) strings.push(derived.value);
  }
  for (const line of briefConfig.alwaysIncludeLines) {
    strings.push(line.label, line.value);
  }
  for (const action of briefConfig.suggestedNextActions) {
    strings.push(action.label, action.value);
  }

  return [...new Set(strings)];
}

describe("Deck Playbook — Spanish translation completeness", () => {
  const translatableStrings = collectTranslatableStrings();

  it("collected a non-trivial number of visitor-facing strings (sanity check)", () => {
    expect(translatableStrings.length).toBeGreaterThan(40);
  });

  for (const text of translatableStrings) {
    it(`has a Spanish translation for ${JSON.stringify(text)}`, () => {
      expect(
        Object.hasOwn(ES_PUBLIC_COPY, text),
        `Missing ES_PUBLIC_COPY entry for: ${JSON.stringify(text)}`,
      ).toBe(true);
    });
  }
});
