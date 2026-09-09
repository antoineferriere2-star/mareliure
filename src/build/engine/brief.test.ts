import { describe, expect, it } from "vitest";
import type { BriefLine } from "@/build/schema/brief";
import { defaultDeckBrief } from "@/build/pages/public/defaultDeckBrief";
import { deckPlaybookSchema } from "@/build/playbooks/deckPlaybookSchema";
import { playbookSchema, type PlaybookSchema } from "@/build/schema/playbook";
import type { Answers, InspirationPhotoAnswer } from "@/build/schema/answers";
import { generateProjectBrief } from "./brief";

function findLine(lines: BriefLine[], label: string): BriefLine | undefined {
  return lines.find((l) => l.label === label);
}

/**
 * Acceptance check for the Deck migration: the business rules that used to
 * be hand-written TypeScript in the old `deckProjectBrief.ts` must now be
 * reproduced purely from `deckPlaybookSchema` data, interpreted generically
 * by `generateProjectBrief`. `defaultDeckBrief` is the same example answer
 * set the old file used to hard-code its static marketing example from.
 */
describe("Deck playbook — brief generation reproduces the original business rules", () => {
  it("computes the area from length * width and tags it as calculated", () => {
    const area = findLine(defaultDeckBrief.assumptionsAndCalculated, "Approximate area");
    expect(area).toEqual({
      label: "Approximate area",
      value: "252 sq ft",
      source: "calculated_value",
      category: "Project details",
      fieldKey: "computedArea",
    });
  });

  it("flags Access limitations, but not the Not-sure/fast-timeline constraints", () => {
    const constraints = defaultDeckBrief.constraints;
    expect(findLine(constraints, "Access")?.value).toBe("Visitor reported access limitations.");
    expect(findLine(constraints, "Project scope")).toBeUndefined();
    expect(findLine(constraints, "Timing")).toBeUndefined();
  });

  it("reports the existing site condition once, under confirmedInformation, not duplicated as a constraint", () => {
    expect(findLine(defaultDeckBrief.confirmedInformation, "Existing situation")?.value).toBe(
      "Existing wood deck",
    );
    expect(findLine(defaultDeckBrief.constraints, "Existing structure")).toBeUndefined();
  });

  it("always injects the permits/structural caveats, and omits gaps that were actually answered", () => {
    const missing = defaultDeckBrief.missingInformation;
    expect(findLine(missing, "Permits")?.value).toBe(
      "Permit requirements were not assessed in this demo.",
    );
    expect(findLine(missing, "Structural condition")).toBeDefined();
    expect(findLine(missing, "Phone")).toBeUndefined();
    expect(findLine(missing, "Photos")).toBeUndefined();
    expect(findLine(missing, "Exact dimensions")).toBeUndefined();
  });

  it("maps budget and timeline verbatim", () => {
    expect(findLine(defaultDeckBrief.budgetAndTiming, "Budget range")?.value).toBe("$25k-$50k");
    expect(findLine(defaultDeckBrief.budgetAndTiming, "Timeline")?.value).toBe("Within 3 months");
  });

  it("builds the same templated project summary as the original hand-written logic", () => {
    expect(defaultDeckBrief.projectSummary).toBe(
      "Deck replacement for a single-family home around 252 sq ft with interest in composite",
    );
  });

  it("keeps the single static suggested next action", () => {
    expect(defaultDeckBrief.suggestedNextAction.value).toBe(
      "Confirm dimensions and site constraints, then schedule a site visit before preparing a detailed estimate.",
    );
  });

  it("reports high confidence when every required/recommended field is answered", () => {
    expect(defaultDeckBrief.confidence).toEqual({ score: 100, label: "high", reasons: [] });
  });

  it("falls back to the raw totalArea answer when length/width are not both given", () => {
    const answers: Answers = {
      ...({} as Answers),
      projectType: "New deck",
      propertyType: "Single-family home",
      existingSituation: "No existing deck",
      totalArea: "about 200 sq ft",
      heightAccess: ["Ground-level"],
      desiredMaterial: "Composite",
      budgetRange: "Not sure yet",
      timeline: "Just exploring",
      location: { zip: "10001" },
      name: "Test",
      email: "test@example.com",
      consent: true,
    };
    const brief = generateProjectBrief(deckPlaybookSchema, answers, {
      name: "Deck Project Intake Demo",
    });
    const area = findLine(brief.confirmedInformation, "Approximate area");
    expect(area).toEqual({
      label: "Approximate area",
      value: "about 200 sq ft",
      source: "visitor_answer",
      category: "Project details",
      fieldKey: "computedArea",
    });
    expect(findLine(brief.assumptionsAndCalculated, "Approximate area")).toBeUndefined();
  });

  it("reports missing dimensions when neither length/width nor totalArea are given", () => {
    const answers: Answers = {
      projectType: "New deck",
      propertyType: "Single-family home",
      existingSituation: "No existing deck",
      heightAccess: ["Ground-level"],
      desiredMaterial: "Composite",
      budgetRange: "Not sure yet",
      timeline: "Just exploring",
      location: { zip: "10001" },
      name: "Test",
      email: "test@example.com",
      consent: true,
    };
    const brief = generateProjectBrief(deckPlaybookSchema, answers, {
      name: "Deck Project Intake Demo",
    });
    expect(findLine(brief.missingInformation, "Exact dimensions")?.value).toBe(
      "Approximate dimensions were not confirmed.",
    );
    expect(brief.projectSummary).toBe(
      "New deck for a single-family home with dimensions still unclear with interest in composite",
    );
  });
});

describe("Option labels in the Brief", () => {
  it("renders single-choice, timeline and budget stored values as human labels", () => {
    const schema = playbookSchema.parse({
      schemaVersion: 1,
      sections: [
        {
          id: "s1",
          title: "Project",
          steps: [
            {
              id: "step1",
              title: "Details",
              fields: [
                {
                  key: "siteType",
                  label: "Site type",
                  type: "single_choice",
                  desirability: "required",
                  options: [{ value: "garden_ground_level", label: "Garden / Ground level" }],
                  briefMapping: {
                    section: "confirmedInformation",
                    label: "Site type",
                    format: "option_label",
                  },
                },
                {
                  key: "budget",
                  label: "Budget",
                  type: "budget",
                  desirability: "required",
                  currency: "USD",
                  mode: "ranges",
                  ranges: [{ value: "7_000_15_000", label: "$7,000-$15,000" }],
                  briefMapping: {
                    section: "budgetAndTiming",
                    label: "Budget",
                    format: "option_label",
                  },
                },
                {
                  key: "timeline",
                  label: "Timeline",
                  type: "timeline",
                  desirability: "required",
                  options: [{ value: "within_3_months", label: "Within 3 months" }],
                  briefMapping: {
                    section: "budgetAndTiming",
                    label: "Timeline",
                    format: "option_label",
                  },
                },
              ],
            },
          ],
        },
      ],
      briefConfig: { suggestedNextActions: [{ label: "Next", value: "Follow up." }] },
    });

    const brief = generateProjectBrief(
      schema,
      {
        siteType: "garden_ground_level",
        budget: "7_000_15_000",
        timeline: "within_3_months",
      },
      { name: "Test Mission" },
    );

    expect(findLine(brief.confirmedInformation, "Site type")?.value).toBe("Garden / Ground level");
    expect(findLine(brief.budgetAndTiming, "Budget")?.value).toBe("$7,000-$15,000");
    expect(findLine(brief.budgetAndTiming, "Timeline")?.value).toBe("Within 3 months");
  });
});

function inspirationSchema(): PlaybookSchema {
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
              { key: "inspiration", label: "Photo d'inspiration", type: "inspiration_photo" },
            ],
          },
        ],
      },
    ],
    briefConfig: { suggestedNextActions: [{ label: "Next", value: "Follow up." }] },
  });
}

describe("Inspiration-photo hypotheses in the Brief", () => {
  it("puts a confirmed dimension in confirmedInformation as a visitor_answer", () => {
    const answer: InspirationPhotoAnswer = {
      photoPath: "sessions/abc/photo.jpg",
      hypotheses: { style: "Moderne", materials: ["Composite"], elements: [] },
      confirmed: { style: true },
      suggestedQuestions: [],
    };
    const brief = generateProjectBrief(
      inspirationSchema(),
      { inspiration: answer } as unknown as Answers,
      { name: "Test" },
    );

    const style = findLine(brief.confirmedInformation, "Style");
    expect(style).toEqual({
      label: "Style",
      value: "Moderne",
      source: "visitor_answer",
      category: "Inspiration",
      fieldKey: "inspiration",
    });
  });

  it("leaves an unconfirmed dimension as an image_hypothesis in assumptionsAndCalculated", () => {
    const answer: InspirationPhotoAnswer = {
      photoPath: "sessions/abc/photo.jpg",
      hypotheses: { style: "Moderne", materials: ["Composite", "Bois"], elements: [] },
      confirmed: { style: true }, // materials left unconfirmed
      suggestedQuestions: [],
    };
    const brief = generateProjectBrief(
      inspirationSchema(),
      { inspiration: answer } as unknown as Answers,
      { name: "Test" },
    );

    const materials = findLine(brief.assumptionsAndCalculated, "Materials");
    expect(materials).toEqual({
      label: "Materials",
      value: "Composite, Bois",
      source: "image_hypothesis",
      category: "Inspiration",
      fieldKey: "inspiration",
    });
    expect(findLine(brief.confirmedInformation, "Materials")).toBeUndefined();
  });

  it("adds the suggested follow-up questions to missingInformation as an image_hypothesis", () => {
    const answer: InspirationPhotoAnswer = {
      photoPath: "sessions/abc/photo.jpg",
      hypotheses: { materials: [], elements: [] },
      confirmed: {},
      suggestedQuestions: ["Quelle surface envisagez-vous ?", "Avez-vous une terrasse existante ?"],
    };
    const brief = generateProjectBrief(
      inspirationSchema(),
      { inspiration: answer } as unknown as Answers,
      { name: "Test" },
    );

    const line = findLine(
      brief.missingInformation,
      "Questions to explore (from the inspiration photo)",
    );
    expect(line?.source).toBe("image_hypothesis");
    expect(line?.value).toContain("Quelle surface envisagez-vous ?");
  });

  it("skips empty hypothesis dimensions entirely rather than emitting blank lines", () => {
    const answer: InspirationPhotoAnswer = {
      photoPath: "sessions/abc/photo.jpg",
      hypotheses: { materials: [], elements: [] },
      confirmed: {},
      suggestedQuestions: [],
    };
    const brief = generateProjectBrief(
      inspirationSchema(),
      { inspiration: answer } as unknown as Answers,
      { name: "Test" },
    );

    expect(findLine(brief.confirmedInformation, "Style")).toBeUndefined();
    expect(findLine(brief.assumptionsAndCalculated, "Style")).toBeUndefined();
    expect(findLine(brief.assumptionsAndCalculated, "Materials")).toBeUndefined();
  });
});

describe("the Dossier never shows a stored value where a person expects a word", () => {
  /**
   * The bug this guards: briefMapping.format defaults to "raw", so any field
   * whose Playbook did not explicitly ask for "option_label" put its stored
   * value straight into the Dossier. The contractor opening the document
   * before a sales call read `garden_ground_level` and `7_000_15_000`, while
   * the visitor who typed the answers saw proper words — the review screen
   * goes through formatAnswerForDisplay, which always asked for labels.
   */
  function machineLooking(value: string): boolean {
    // A stored option value: lowercase words joined by underscores, or the
    // digit-underscore shape budget ranges use (7_000_15_000).
    return /(^|\s)[a-z0-9]+(_[a-z0-9]+)+(\s|$)/.test(value);
  }

  it("resolves an option to its label even when the Playbook asked for raw", () => {
    const field = {
      key: "surface",
      label: "Current ground surface",
      type: "single_choice" as const,
      options: [
        { value: "soil_or_lawn", label: "Soil or lawn" },
        { value: "existing_slab", label: "Existing slab" },
      ],
      briefMapping: {
        section: "confirmedInformation" as const,
        label: "Ground surface",
        // No `format`, so it defaults to "raw" — the shape that shipped the bug.
      },
    };
    const schema = playbookSchema.parse({
      ...deckPlaybookSchema,
      sections: [
        {
          id: "s",
          title: "S",
          steps: [{ id: "st", title: "T", fields: [field] }],
        },
      ],
    });
    const brief = generateProjectBrief(schema, { surface: "soil_or_lawn" }, { name: "M" });
    const line = findLine(brief.confirmedInformation, "Ground surface");
    expect(line?.value).toBe("Soil or lawn");
    expect(line?.value).not.toBe("soil_or_lawn");
  });

  it("leaves free text, numbers and dates untouched", () => {
    // optionLabel returns anything it cannot match, so resolving labels
    // unconditionally must not mangle a field that has no options.
    const brief = generateProjectBrief(
      deckPlaybookSchema,
      { length: 20, width: 10, location: { zip: "78704" }, email: "a@b.com" },
      { name: "M" },
    );
    const all = [...brief.confirmedInformation, ...brief.missingInformation];
    expect(all.some((line) => line.value.includes("78704"))).toBe(true);
  });

  it("puts no machine-looking value in the reference deck brief", () => {
    // The end-to-end guard the audit asked for: whatever a Playbook declares,
    // nothing that reaches the contractor may read as a database row.
    const lines: BriefLine[] = [
      ...defaultDeckBrief.confirmedInformation,
      ...defaultDeckBrief.assumptionsAndCalculated,
      ...defaultDeckBrief.constraints,
      ...defaultDeckBrief.missingInformation,
      ...defaultDeckBrief.budgetAndTiming,
      defaultDeckBrief.suggestedNextAction,
    ];
    const offenders = lines.filter((line) => machineLooking(line.value));
    expect(offenders.map((l) => `${l.label}: ${l.value}`)).toEqual([]);
  });
});

describe("an option may read differently in the Brief than in the question", () => {
  /**
   * Une option répond à une question posée : « Que souhaitez-vous faire ? »
   * appelle « Le réparer ». Un Dossier, lui, énonce — « Type de projet : Le
   * réparer » ne se lit pas.
   *
   * Sans `briefLabel`, il fallait choisir entre une question qui sonne juste et
   * un Dossier qui sonne juste. Rien ici ne connaît de métier : c'est le
   * Playbook qui décide s'il en déclare un.
   */
  const schema = playbookSchema.parse({
    schemaVersion: 1,
    sections: [
      {
        id: "s1",
        title: "Project",
        steps: [
          {
            id: "step1",
            title: "Details",
            fields: [
              {
                key: "intent",
                label: "What do you want?",
                type: "single_choice",
                desirability: "required",
                options: [
                  { value: "fix", label: "Fix it", briefLabel: "Repair" },
                  { value: "keep", label: "Keep it as it is" },
                ],
                briefMapping: {
                  section: "confirmedInformation",
                  label: "Intent",
                  format: "option_label",
                },
              },
            ],
          },
        ],
      },
    ],
  }) as PlaybookSchema;

  it("prefers the brief label when the Playbook declares one", () => {
    const brief = generateProjectBrief(schema, { intent: "fix" }, { name: "M" });
    expect(findLine(brief.confirmedInformation, "Intent")?.value).toBe("Repair");
  });

  it("falls back to the question label when it does not", () => {
    const brief = generateProjectBrief(schema, { intent: "keep" }, { name: "M" });
    expect(findLine(brief.confirmedInformation, "Intent")?.value).toBe("Keep it as it is");
  });
});
