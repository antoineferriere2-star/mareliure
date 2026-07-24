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
    expect(area).toEqual({ label: "Approximate area", value: "252 sq ft", source: "calculated_value", category: "Project details", fieldKey: "computedArea" });
  });

  it("flags Access limitations, existing structure, but not the Not-sure/fast-timeline constraints", () => {
    const constraints = defaultDeckBrief.constraints;
    expect(findLine(constraints, "Access")?.value).toBe("Visitor reported access limitations.");
    expect(findLine(constraints, "Existing structure")?.value).toBe("Existing wood deck");
    expect(findLine(constraints, "Existing structure")?.source).toBe("visitor_answer");
    expect(findLine(constraints, "Project scope")).toBeUndefined();
    expect(findLine(constraints, "Timing")).toBeUndefined();
  });

  it("always injects the permits/structural caveats, and omits gaps that were actually answered", () => {
    const missing = defaultDeckBrief.missingInformation;
    expect(findLine(missing, "Permits")?.value).toBe("Permit requirements were not assessed in this demo.");
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
    const brief = generateProjectBrief(deckPlaybookSchema, answers, { name: "Deck Project Intake Demo" });
    const area = findLine(brief.confirmedInformation, "Approximate area");
    expect(area).toEqual({ label: "Approximate area", value: "about 200 sq ft", source: "visitor_answer", category: "Project details", fieldKey: "computedArea" });
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
    const brief = generateProjectBrief(deckPlaybookSchema, answers, { name: "Deck Project Intake Demo" });
    expect(findLine(brief.missingInformation, "Exact dimensions")?.value).toBe("Approximate dimensions were not confirmed.");
    expect(brief.projectSummary).toBe("New deck for a single-family home with dimensions still unclear with interest in composite");
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
    const brief = generateProjectBrief(inspirationSchema(), { inspiration: answer } as unknown as Answers, { name: "Test" });

    const style = findLine(brief.confirmedInformation, "Style");
    expect(style).toEqual({ label: "Style", value: "Moderne", source: "visitor_answer", category: "Inspiration", fieldKey: "inspiration" });
  });

  it("leaves an unconfirmed dimension as an image_hypothesis in assumptionsAndCalculated", () => {
    const answer: InspirationPhotoAnswer = {
      photoPath: "sessions/abc/photo.jpg",
      hypotheses: { style: "Moderne", materials: ["Composite", "Bois"], elements: [] },
      confirmed: { style: true }, // materials left unconfirmed
      suggestedQuestions: [],
    };
    const brief = generateProjectBrief(inspirationSchema(), { inspiration: answer } as unknown as Answers, { name: "Test" });

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
    const brief = generateProjectBrief(inspirationSchema(), { inspiration: answer } as unknown as Answers, { name: "Test" });

    const line = findLine(brief.missingInformation, "Questions to explore (from the inspiration photo)");
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
    const brief = generateProjectBrief(inspirationSchema(), { inspiration: answer } as unknown as Answers, { name: "Test" });

    expect(findLine(brief.confirmedInformation, "Style")).toBeUndefined();
    expect(findLine(brief.assumptionsAndCalculated, "Style")).toBeUndefined();
    expect(findLine(brief.assumptionsAndCalculated, "Materials")).toBeUndefined();
  });
});
