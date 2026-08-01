// Regression guard for the "two questions in one grid, no visual
// separation" bug: SingleChoiceField, MultiChoiceField, TimelineField and
// BudgetField (ranges mode) used to render only a grid of buttons with no
// heading at all, so a step with two of these fields back-to-back (e.g. the
// Deck Playbook's "property" step: propertyType + existingSituation) looked
// like one big undifferentiated grid. Uses React.createElement + renderToStaticMarkup
// (no JSX/testing-library — this repo's vitest config only picks up .test.ts,
// and this stays a plain Node-environment string-render check) to assert
// each field renders its own <fieldset><legend> naming the question it
// answers.
//
// Not covered here (documented, not silently skipped): actual click
// interaction and keyboard navigation, since renderToStaticMarkup has no
// event system. Selection independence between two fields in the same step
// is structural rather than something to click-test — MissionRuntime keys
// each field's value by its own field.key in the Answers record
// (src/build/pages/public/MissionRuntime.tsx), so one field's onChange can
// only ever write to its own key.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { deckPlaybookSchema } from "@/build/playbooks/deckPlaybookSchema";
import type {
  BudgetField as BudgetFieldDef,
  MultiChoiceField as MultiChoiceFieldDef,
  SingleChoiceField as SingleChoiceFieldDef,
  TimelineField as TimelineFieldDef,
} from "@/build/schema/playbook";
import { BudgetField } from "./BudgetField";
import { MultiChoiceField } from "./MultiChoiceField";
import { SingleChoiceField } from "./SingleChoiceField";
import { TimelineField } from "./TimelineField";

function findField(stepId: string, fieldKey: string) {
  const step = deckPlaybookSchema.sections
    .flatMap((section) => section.steps)
    .find((s) => s.id === stepId);
  if (!step) throw new Error(`Step not found: ${stepId}`);
  const field = step.fields.find((f) => f.key === fieldKey);
  if (!field) throw new Error(`Field not found: ${fieldKey} in step ${stepId}`);
  return field;
}

describe("choice-grid field components render a distinct legend", () => {
  it("SingleChoiceField renders a <legend> with the field label as a radiogroup", () => {
    const field = findField("property", "propertyType") as SingleChoiceFieldDef;
    const html = renderToStaticMarkup(
      createElement(SingleChoiceField, { field, value: undefined, onChange: () => {} }),
    );
    expect(html).toContain("<fieldset");
    expect(html).toContain("<legend");
    expect(html).toContain(field.label);
    expect(html).toContain('role="radiogroup"');
  });

  it("MultiChoiceField renders a <legend> with the field label as a group", () => {
    const field = findField("heightAccess", "heightAccess") as MultiChoiceFieldDef;
    const html = renderToStaticMarkup(
      createElement(MultiChoiceField, { field, value: undefined, onChange: () => {} }),
    );
    expect(html).toContain("<fieldset");
    expect(html).toContain("<legend");
    expect(html).toContain(field.label);
    expect(html).toContain('role="group"');
  });

  it("TimelineField renders a <legend> with the field label as a radiogroup", () => {
    const field = findField("budgetTimeline", "timeline") as TimelineFieldDef;
    const html = renderToStaticMarkup(
      createElement(TimelineField, { field, value: undefined, onChange: () => {} }),
    );
    expect(html).toContain("<fieldset");
    expect(html).toContain("<legend");
    expect(html).toContain(field.label);
    expect(html).toContain('role="radiogroup"');
  });

  it("BudgetField in ranges mode renders a <legend> with the field label", () => {
    const field = findField("budgetTimeline", "budgetRange") as BudgetFieldDef;
    const html = renderToStaticMarkup(
      createElement(BudgetField, { field, value: undefined, onChange: () => {} }),
    );
    expect(html).toContain("<fieldset");
    expect(html).toContain("<legend");
    expect(html).toContain(field.label);
    expect(html).toContain('role="radiogroup"');
  });

  it("the property step's two fields render two distinct legends, not a merged grid", () => {
    const propertyType = findField("property", "propertyType") as SingleChoiceFieldDef;
    const existingSituation = findField("property", "existingSituation") as SingleChoiceFieldDef;

    const propertyTypeHtml = renderToStaticMarkup(
      createElement(SingleChoiceField, {
        field: propertyType,
        value: undefined,
        onChange: () => {},
      }),
    );
    const existingSituationHtml = renderToStaticMarkup(
      createElement(SingleChoiceField, {
        field: existingSituation,
        value: undefined,
        onChange: () => {},
      }),
    );

    expect(propertyType.label).not.toBe(existingSituation.label);
    expect(propertyTypeHtml).toContain(propertyType.label);
    expect(existingSituationHtml).toContain(existingSituation.label);
    // Each field renders as its own independent <fieldset> — MissionRuntime
    // stacks these two, it never merges their option grids into one.
    expect((propertyTypeHtml.match(/<fieldset/g) ?? []).length).toBe(1);
    expect((existingSituationHtml.match(/<fieldset/g) ?? []).length).toBe(1);
  });

  it("the budgetTimeline step's two fields render two distinct legends", () => {
    const budgetRange = findField("budgetTimeline", "budgetRange") as BudgetFieldDef;
    const timeline = findField("budgetTimeline", "timeline") as TimelineFieldDef;
    expect(budgetRange.label).not.toBe(timeline.label);
  });
});
