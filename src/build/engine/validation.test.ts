import { describe, expect, it } from "vitest";
import { playbookSchema, type PlaybookField } from "@/build/schema/playbook";
import {
  computeUnansweredRequiredFields,
  computeVisibleSteps,
  getPlaybookPublishIssues,
  validateField,
} from "./validation";

const textField: PlaybookField = {
  key: "name",
  label: "Name",
  type: "text",
  desirability: "required",
};
const choiceField: PlaybookField = {
  key: "color",
  label: "Color",
  type: "single_choice",
  desirability: "optional",
  options: [{ value: "red", label: "Red" }],
};

const zipField: PlaybookField = {
  key: "address",
  label: "Address",
  type: "address",
  desirability: "optional",
  components: [{ key: "zip", label: "ZIP code", pattern: "^\\d{5}(-\\d{4})?$" }],
};

describe("validateField", () => {
  it("rejects an address component value that fails its optional pattern", () => {
    expect(validateField(zipField, { zip: "abc" })).toMatch(/ZIP code.*not valid/);
    expect(validateField(zipField, { zip: "94103" })).toBeNull();
    expect(validateField(zipField, { zip: "94103-1234" })).toBeNull();
  });

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
          {
            id: "step1",
            title: "Step 1",
            fields: [{ key: "hasPool", label: "Has pool?", type: "consent", consentText: "Yes" }],
          },
          {
            id: "step2",
            title: "Step 2 (pool only)",
            displayWhen: { all: [{ fieldKey: "hasPool", operator: "equals", value: true }] },
            fields: [
              { key: "poolSize", label: "Pool size", type: "text", desirability: "required" },
            ],
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

  function photoSchema(overrides: Record<string, unknown>) {
    return playbookSchema.parse({
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
                  key: "sitePhotos",
                  label: "Site photos",
                  type: "photo",
                  desirability: "optional",
                  maxFiles: 6,
                  maxFileSizeMb: 8,
                  acceptMimeTypes: ["image/jpeg"],
                  storage: "supabase_storage",
                  ...overrides,
                },
              ],
            },
          ],
        },
      ],
      briefConfig: { suggestedNextActions: [{ label: "Next", value: "Follow up." }] },
    });
  }

  it("publishes a Storage-backed photo field that fits the bucket", () => {
    // This used to be refused outright: uploads were unimplemented and the
    // files would have been silently discarded. They are stored now.
    expect(getPlaybookPublishIssues(photoSchema({})).some((i) => i.includes("sitePhotos"))).toBe(
      false,
    );
  });

  it("refuses a Storage-backed photo field the bucket would reject", () => {
    // Passing the app-side check and then failing inside Storage shows the
    // visitor a 500 mid-upload — catch it while the author can still fix it.
    const tooBig = getPlaybookPublishIssues(photoSchema({ maxFileSizeMb: 25 }));
    expect(tooBig.some((i) => i.includes("sitePhotos") && i.includes("MB"))).toBe(true);

    const badType = getPlaybookPublishIssues(photoSchema({ acceptMimeTypes: ["image/gif"] }));
    expect(badType.some((i) => i.includes("sitePhotos") && i.includes("image/gif"))).toBe(true);

    const tooMany = getPlaybookPublishIssues(photoSchema({ maxFiles: 50 }));
    expect(tooMany.some((i) => i.includes("sitePhotos") && i.includes("50 files"))).toBe(true);
  });

  it("allows the implemented filename_only photo mode", () => {
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
                  key: "sitePhotos",
                  label: "Site photos",
                  type: "photo",
                  desirability: "optional",
                  maxFiles: 6,
                  maxFileSizeMb: 8,
                  acceptMimeTypes: ["image/jpeg"],
                  storage: "filename_only",
                },
              ],
            },
          ],
        },
      ],
      briefConfig: { suggestedNextActions: [{ label: "Next", value: "Follow up." }] },
    });
    expect(getPlaybookPublishIssues(schema).some((i) => i.includes("sitePhotos"))).toBe(false);
  });

  function schemaWithInspirationPhoto(overrides: Record<string, unknown>) {
    return playbookSchema.parse({
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
                  key: "inspiration",
                  label: "Inspiration photo",
                  type: "inspiration_photo",
                  desirability: "optional",
                  ...overrides,
                },
              ],
            },
          ],
        },
      ],
      briefConfig: { suggestedNextActions: [{ label: "Next", value: "Follow up." }] },
    });
  }

  it("refuses an inspiration photo field larger than the Storage bucket allows", () => {
    // Storage would reject the upload mid-request, which the visitor sees as
    // a server error — catch it while the author can still fix it.
    const issues = getPlaybookPublishIssues(schemaWithInspirationPhoto({ maxFileSizeMb: 15 }));
    expect(issues.some((i) => i.includes("15 MB") && i.includes("8 MB"))).toBe(true);
  });

  it("refuses an inspiration photo field accepting a MIME type Storage rejects", () => {
    const issues = getPlaybookPublishIssues(
      schemaWithInspirationPhoto({ acceptMimeTypes: ["image/jpeg", "image/heic"] }),
    );
    expect(issues.some((i) => i.includes("image/heic"))).toBe(true);
  });

  it("accepts an inspiration photo field within the bucket's limits", () => {
    const issues = getPlaybookPublishIssues(
      schemaWithInspirationPhoto({ maxFileSizeMb: 8, acceptMimeTypes: ["image/jpeg"] }),
    );
    expect(issues.some((i) => i.includes("inspiration"))).toBe(false);
  });

  it("requires at least one unconditional suggested next action", () => {
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
              fields: [{ key: "a", label: "A", type: "text", desirability: "optional" }],
            },
          ],
        },
      ],
      briefConfig: { suggestedNextActions: [] },
    });
    expect(getPlaybookPublishIssues(schema)).toContain(
      "At least one suggested next action is required.",
    );
  });
});

describe("a consistency rule that can never fire is refused at publish", () => {
  function schemaWithRule(rule: Record<string, unknown>) {
    return playbookSchema.parse({
      schemaVersion: 1,
      sections: [
        {
          id: "s1",
          title: "Section",
          steps: [
            {
              id: "step1",
              title: "Step",
              fields: [{ key: "a", label: "A", type: "text", desirability: "optional" }],
            },
          ],
        },
      ],
      validationRules: [rule],
      briefConfig: { suggestedNextActions: [{ label: "Next", value: "Follow up." }] },
    });
  }

  it("refuses a rule with no condition", () => {
    // evaluateConditionGroup({}) is true, and the editor's "+ Rule" button
    // creates exactly this shape — without the guard every unfinished rule
    // would fire on every visitor.
    const schema = schemaWithRule({
      id: "blank",
      scope: "playbook",
      severity: "warning",
      message: "Something is off.",
      when: {},
    });
    expect(getPlaybookPublishIssues(schema)).toContain(
      'Validation rule "blank" has no condition, so it can never trigger.',
    );
  });

  it("refuses a step-scoped rule attached to no step, or to an unknown one", () => {
    const orphan = schemaWithRule({
      id: "orphan",
      scope: "step",
      severity: "error",
      message: "Something is off.",
      when: { all: [{ fieldKey: "a", operator: "is_empty" }] },
    });
    expect(getPlaybookPublishIssues(orphan)).toContain(
      'Validation rule "orphan" is attached to no step, so it can never trigger.',
    );

    const ghost = schemaWithRule({
      id: "ghost-step",
      scope: "step",
      stepId: "nope",
      severity: "error",
      message: "Something is off.",
      when: { all: [{ fieldKey: "a", operator: "is_empty" }] },
    });
    expect(getPlaybookPublishIssues(ghost)).toContain(
      'Validation rule "ghost-step" is attached to unknown step "nope", so it can never trigger.',
    );
  });

  it("accepts a fully-wired rule", () => {
    const schema = schemaWithRule({
      id: "ok",
      scope: "step",
      stepId: "step1",
      severity: "error",
      message: "Something is off.",
      when: { all: [{ fieldKey: "a", operator: "is_empty" }] },
    });
    expect(getPlaybookPublishIssues(schema).some((i) => i.includes('rule "ok"'))).toBe(false);
  });
});
