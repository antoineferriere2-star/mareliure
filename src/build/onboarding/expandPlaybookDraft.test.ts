import { describe, expect, it } from "vitest";
import { playbookSchema } from "@/build/schema/playbook";
import { expandPlaybookDraft, type PlaybookDraft } from "./expandPlaybookDraft";

const richDraft: PlaybookDraft = {
  steps: [
    {
      title: "What kind of binding project is this?",
      why: "Helps route the request to the right specialist.",
      fields: [
        {
          label: "Project type",
          type: "single_choice",
          required: true,
          options: ["Book restoration", "New binding", "Repair"],
        },
        {
          label: "Materials of interest",
          type: "multi_choice",
          required: false,
          options: ["Leather", "Cloth"],
        },
      ],
    },
    {
      title: "Budget and timeline",
      why: "Helps prioritize follow-up.",
      fields: [
        {
          label: "Budget range",
          type: "budget",
          required: true,
          options: ["Under $100", "$100-$300"],
        },
        { label: "Timeline", type: "timeline", required: true, options: ["ASAP", "Flexible"] },
      ],
    },
  ],
};

describe("expandPlaybookDraft", () => {
  it("produces a schema that satisfies playbookSchema", () => {
    const schema = expandPlaybookDraft(richDraft, "Atelier de reliure", "Reliure de livres");
    expect(() => playbookSchema.parse(schema)).not.toThrow();
  });

  it("always appends a contact step with name/email/phone/consent", () => {
    const schema = expandPlaybookDraft(richDraft, "Atelier de reliure", "Reliure de livres");
    const lastStep = schema.sections[0]!.steps.at(-1)!;
    const keys = lastStep.fields.map((f) => f.key);
    expect(keys).toEqual(["name", "email", "phone", "consent"]);
    expect(lastStep.fields.find((f) => f.key === "consent")?.type).toBe("consent");
  });

  it("routes budget/timeline fields to budgetAndTiming, everything else to confirmedInformation", () => {
    const schema = expandPlaybookDraft(richDraft, "Atelier de reliure", "Reliure de livres");
    const allFields = schema.sections[0]!.steps.flatMap((s) => s.fields);
    const budgetField = allFields.find((f) => f.label === "Budget range");
    const timelineField = allFields.find((f) => f.label === "Timeline");
    const projectTypeField = allFields.find((f) => f.label === "Project type");
    expect(budgetField?.briefMapping?.section).toBe("budgetAndTiming");
    expect(timelineField?.briefMapping?.section).toBe("budgetAndTiming");
    expect(projectTypeField?.briefMapping?.section).toBe("confirmedInformation");
  });

  it("maps generated option fields to human labels in the Project Brief", () => {
    const schema = expandPlaybookDraft(richDraft, "Bookbinder", "Book binding");
    const allFields = schema.sections[0]!.steps.flatMap((s) => s.fields);
    const projectTypeField = allFields.find((f) => f.label === "Project type");
    const materialsField = allFields.find((f) => f.label === "Materials of interest");
    const budgetField = allFields.find((f) => f.label === "Budget range");
    const timelineField = allFields.find((f) => f.label === "Timeline");

    expect(projectTypeField?.briefMapping?.format).toBe("option_label");
    expect(materialsField?.briefMapping?.format).toBe("join_comma");
    expect(budgetField?.briefMapping?.format).toBe("option_label");
    expect(timelineField?.briefMapping?.format).toBe("option_label");
  });

  it("deduplicates field keys, including against the reserved contact keys", () => {
    const draftWithCollision: PlaybookDraft = {
      steps: [
        {
          title: "Details",
          why: "",
          fields: [
            { label: "Email", type: "text", required: false }, // collides with the reserved contact key
            { label: "Email", type: "text", required: false }, // collides with itself too
          ],
        },
      ],
    };
    const schema = expandPlaybookDraft(draftWithCollision, "Test", "Test product");
    const keys = schema.sections[0]!.steps.flatMap((s) => s.fields).map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length); // all unique
    expect(keys.filter((k) => k.startsWith("email"))).toHaveLength(3); // the 2 generated + the real contact "email"
  });

  it("falls back to generic options when a choice field has none, rather than producing an unsubmittable field", () => {
    const draftMissingOptions: PlaybookDraft = {
      steps: [
        {
          title: "Preferences",
          why: "",
          fields: [{ label: "Preferred style", type: "single_choice", required: true }],
        },
      ],
    };
    const schema = expandPlaybookDraft(draftMissingOptions, "Test", "Test product");
    const field = schema.sections[0]!.steps[0]!.fields[0];
    expect(field?.type).toBe("single_choice");
    if (field?.type === "single_choice") {
      expect(field.options.length).toBeGreaterThan(0);
    }
  });

  it("falls back to generic ranges for a budget field with no options, since an empty ranges list would be unanswerable", () => {
    const draftMissingRanges: PlaybookDraft = {
      steps: [
        { title: "Budget", why: "", fields: [{ label: "Budget", type: "budget", required: true }] },
      ],
    };
    const schema = expandPlaybookDraft(draftMissingRanges, "Test", "Test product");
    const field = schema.sections[0]!.steps[0]!.fields[0];
    expect(field?.type).toBe("budget");
    if (field?.type === "budget") {
      expect(field.ranges?.length).toBeGreaterThan(0);
    }
  });

  it("includes the business type and product in the empty-summary fallback and section title", () => {
    const schema = expandPlaybookDraft(richDraft, "Atelier de reliure", "Reliure de livres");
    expect(schema.briefConfig.emptySummaryFallback).toContain("Atelier de reliure");
    expect(schema.briefConfig.emptySummaryFallback).toContain("Reliure de livres");
    expect(schema.sections[0]!.title).toContain("Reliure de livres");
  });

  it("always includes exactly one unconditional suggested next action", () => {
    const schema = expandPlaybookDraft(richDraft, "Atelier de reliure", "Reliure de livres");
    expect(schema.briefConfig.suggestedNextActions).toHaveLength(1);
    expect(schema.briefConfig.suggestedNextActions[0]?.when).toBeUndefined();
  });
});
