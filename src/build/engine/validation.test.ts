import { describe, expect, it } from "vitest";
import { playbookSchema, type PlaybookField } from "@/build/schema/playbook";
import { computeUnansweredRequiredFields, computeVisibleSteps, getPlaybookPublishIssues, validateField } from "./validation";

const textField: PlaybookField = { key: "name", label: "Name", type: "text", desirability: "required" };
const choiceField: PlaybookField = {
  key: "color",
  label: "Color",
  type: "single_choice",
  desirability: "optional",
  options: [{ value: "red", label: "Red" }],
};

describe("validateField", () => {
  it("requires required fields to be non-empty", () => {
    expect(validateField(textField, undefined)).toMatch(/required/);
    expect(validateField(textField, "Alice")).toBeNull();
  });

  it("accepts __NOT_SURE__ only when allowNotSure is set", () => {
    expect(validateField(textField, "__NOT_SURE__")).not.toBeNull();
    expect(validateField({ ...textField, allowNotSure: true }, "__NOT_SURE__")).toBeNull();
  });

  it("rejects a choice value that is not one of the field's options", () => {
    expect(validateField(choiceField, "purple")).not.toBeNull();
    expect(validateField(choiceField, "red")).toBeNull();
  });

  it("optional empty fields are valid", () => {
    expect(validateField(choiceField, undefined)).toBeNull();
  });
});

function schemaWithConditionalStep(): ReturnType<typeof playbookSchema.parse> {
  return playbookSchema.parse({
    schemaVersion: 1,
    sections: [
      {
        id: "s1",
        title: "Section",
        steps: [
          { id: "step1", title: "Step 1", fields: [{ key: "hasPool", label: "Has pool?", type: "consent", consentText: "Yes" }] },
          {
            id: "step2",
            title: "Step 2 (pool only)",
            displayWhen: { all: [{ fieldKey: "hasPool", operator: "equals", value: true }] },
            fields: [{ key: "poolSize", label: "Pool size", type: "text", desirability: "required" }],
          },
        ],
      },
    ],
    briefConfig: { suggestedNextActions: [{ label: "Next", value: "Follow up." }] },
  });
}

describe("computeVisibleSteps / computeUnansweredRequiredFields", () => {
  it("hides a conditional step until its condition is met", () => {
    const schema = schemaWithConditionalStep();
    expect(computeVisibleSteps(schema, {})).toHaveLength(1);
    expect(computeVisibleSteps(schema, { hasPool: true })).toHaveLength(2);
  });

  it("a hidden required field is never reported as unanswered", () => {
    const schema = schemaWithConditionalStep();
    // step1's own "hasPool" is required and unanswered; step2 ("Pool size") is
    // still hidden, so it must not appear yet.
    expect(computeUnansweredRequiredFields(schema, {})).toEqual(["Has pool?"]);
    // Once hasPool is answered, step2 becomes visible and its required field shows up.
    expect(computeUnansweredRequiredFields(schema, { hasPool: true })).toEqual(["Pool size"]);
  });
});

describe("getPlaybookPublishIssues", () => {
  it("flags a playbook with no fields", () => {
    const empty = playbookSchema.parse({ schemaVersion: 1 });
    expect(getPlaybookPublishIssues(empty).length).toBeGreaterThan(0);
  });

  it("flags a dangling displayWhen reference", () => {
    const schema = playbookSchema.parse({
      schemaVersion: 1,
      sections: [
        {
          id: "s1",
          title: "Section",
          steps: [
            {
              id: "step1",
              title: "Step",
              fields: [
                {
                  key: "a",
                  label: "A",
                  type: "text",
                  desirability: "optional",
                  displayWhen: { all: [{ fieldKey: "ghost", operator: "is_not_empty" }] },
                },
              ],
            },
          ],
        },
      ],
      briefConfig: { suggestedNextActions: [{ label: "Next", value: "Follow up." }] },
    });
    const issues = getPlaybookPublishIssues(schema);
    expect(issues.some((i) => i.includes("ghost"))).toBe(true);
  });

  it("requires at least one unconditional suggested next action", () => {
    const schema = playbookSchema.parse({
      schemaVersion: 1,
      sections: [{ id: "s1", title: "Section", steps: [{ id: "step1", title: "Step", fields: [{ key: "a", label: "A", type: "text", desirability: "optional" }] }] }],
      briefConfig: { suggestedNextActions: [] },
    });
    expect(getPlaybookPublishIssues(schema)).toContain("At least one suggested next action is required.");
  });
});
