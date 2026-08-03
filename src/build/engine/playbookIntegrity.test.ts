// Reachability checks: a Playbook can pass Zod and still contain a step no
// visitor can complete. The symptom in production is the worst possible one —
// Continue validates, fails, and nothing moves — so these must be caught at
// publish time, not discovered by a visitor.
import { describe, expect, it } from "vitest";
import { playbookSchema } from "@/build/schema/playbook";
import { getPlaybookPublishIssues } from "./validation";

function schemaWithFields(fields: unknown[]) {
  return playbookSchema.parse({
    schemaVersion: 1,
    sections: [{ id: "s1", title: "Section", steps: [{ id: "step1", title: "Step", fields }] }],
    briefConfig: { suggestedNextActions: [{ label: "Next", value: "Follow up." }] },
  });
}

const materialsBase = {
  key: "materials",
  label: "Timber & Material Selection",
  desirability: "required" as const,
};

describe("choice fields must be answerable", () => {
  it("rejects duplicate option values, which make two options indistinguishable", () => {
    // Exactly what slugify produced before de-duplication: "Pressure-treated
    // pine" and "Pressure treated pine" both collapse to the same value.
    const schema = schemaWithFields([
      {
        ...materialsBase,
        type: "single_choice",
        options: [
          { value: "pressure_treated_pine", label: "Pressure-treated pine" },
          { value: "pressure_treated_pine", label: "Pressure treated pine" },
        ],
      },
    ]);
    const issues = getPlaybookPublishIssues(schema);
    expect(issues.some((i) => i.includes("materials") && i.includes("duplicate option"))).toBe(
      true,
    );
  });

  it("accepts distinct option values", () => {
    const schema = schemaWithFields([
      {
        ...materialsBase,
        type: "single_choice",
        options: [
          { value: "cedar", label: "Cedar" },
          { value: "composite", label: "Composite" },
        ],
      },
    ]);
    expect(getPlaybookPublishIssues(schema).some((i) => i.includes("materials"))).toBe(false);
  });

  it("rejects a multi-choice needing more selections than it has distinct options", () => {
    // The purest "impossible step": the visitor can tick every option and
    // still fail validation, with nothing left to try.
    const schema = schemaWithFields([
      {
        ...materialsBase,
        type: "multi_choice",
        minSelected: 3,
        options: [
          { value: "cedar", label: "Cedar" },
          { value: "composite", label: "Composite" },
        ],
      },
    ]);
    const issues = getPlaybookPublishIssues(schema);
    expect(issues.some((i) => i.includes("could never be completed"))).toBe(true);
  });

  it("counts distinct values, not option entries, when judging minSelected", () => {
    const schema = schemaWithFields([
      {
        ...materialsBase,
        type: "multi_choice",
        minSelected: 2,
        options: [
          { value: "cedar", label: "Cedar" },
          { value: "cedar", label: "cedar" },
        ],
      },
    ]);
    expect(
      getPlaybookPublishIssues(schema).some((i) => i.includes("could never be completed")),
    ).toBe(true);
  });

  it("rejects a multi-choice whose minimum exceeds its maximum", () => {
    const schema = schemaWithFields([
      {
        ...materialsBase,
        type: "multi_choice",
        minSelected: 3,
        maxSelected: 2,
        options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
          { value: "c", label: "C" },
        ],
      },
    ]);
    const issues = getPlaybookPublishIssues(schema);
    expect(issues.some((i) => i.includes("at most"))).toBe(true);
  });

  it("checks budget ranges the same way as options", () => {
    const schema = schemaWithFields([
      {
        key: "budget",
        label: "Budget",
        desirability: "required",
        type: "budget",
        currency: "USD",
        mode: "ranges",
        ranges: [
          { value: "5_000", label: "$5,000" },
          { value: "5_000", label: "$5,000+" },
        ],
      },
    ]);
    expect(getPlaybookPublishIssues(schema).some((i) => i.includes("duplicate option"))).toBe(true);
  });
});

describe("steps must be renderable", () => {
  it("rejects a step declared with no fields", () => {
    const schema = playbookSchema.parse({
      schemaVersion: 1,
      sections: [
        { id: "s1", title: "Section", steps: [{ id: "empty", title: "Empty", fields: [] }] },
      ],
      briefConfig: { suggestedNextActions: [{ label: "Next", value: "Follow up." }] },
    });
    expect(
      getPlaybookPublishIssues(schema).some((i) => i.includes('Step "empty" has no fields')),
    ).toBe(true);
  });
});

describe("the reference Deck Playbook stays publishable", () => {
  it("reports no integrity issue", async () => {
    // The new checks must not turn the shipped Playbook — or any Mission
    // already published from it — into something unpublishable.
    const { deckPlaybookSchema } = await import("@/build/playbooks/deckPlaybookSchema");
    expect(getPlaybookPublishIssues(playbookSchema.parse(deckPlaybookSchema))).toEqual([]);
  });
});
