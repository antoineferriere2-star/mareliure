import { describe, expect, it } from "vitest";
import { NOT_SURE_VALUE } from "@/build/schema/answers";
import type { Answers } from "@/build/schema/answers";
import { emptyPlaybookSchema } from "@/build/schema/playbook";
import type { PlaybookField, PlaybookSchema } from "@/build/schema/playbook";
import { deckPlaybookSchema } from "@/build/playbooks/deckPlaybookSchema";
import { resolveDeckPreviewParams } from "./deckPreviewParams";

function schemaWithFields(fields: PlaybookField[]): PlaybookSchema {
  return {
    ...emptyPlaybookSchema,
    sections: [{ id: "s", title: "s", steps: [{ id: "st", title: "st", fields }] }],
  };
}

const lengthField: PlaybookField = {
  key: "length",
  label: "Length (ft)",
  type: "measurement",
  unit: "ft",
  desirability: "optional",
};
const widthField: PlaybookField = {
  key: "width",
  label: "Width (ft)",
  type: "measurement",
  unit: "ft",
  desirability: "optional",
};
const heightAccessField: PlaybookField = {
  key: "heightAccess",
  label: "Height/access",
  type: "multi_choice",
  desirability: "required",
  options: [
    "Ground-level",
    "Elevated",
    "Second-story",
    "Stairs required",
    "Access limitations",
  ].map((v) => ({
    value: v,
    label: v,
  })),
};

const MINIMAL_DECK_SCHEMA = schemaWithFields([lengthField, widthField, heightAccessField]);

describe("resolveDeckPreviewParams", () => {
  it("returns 'unavailable' when the Playbook has no length/width/heightAccess fields", () => {
    const res = resolveDeckPreviewParams({}, emptyPlaybookSchema);
    expect(res.status).toBe("unavailable");
  });

  it("returns 'unavailable' when only some of the required fields exist", () => {
    const res = resolveDeckPreviewParams({}, schemaWithFields([lengthField, widthField]));
    expect(res.status).toBe("unavailable");
  });

  it("returns 'complete' with normalized meters when length and width are both real numbers", () => {
    const answers: Answers = { length: 12, width: 10, heightAccess: ["Ground-level"] };
    const res = resolveDeckPreviewParams(answers, MINIMAL_DECK_SCHEMA);
    expect(res.status).toBe("complete");
    if (res.status !== "complete") throw new Error("unreachable");
    expect(res.params.shape).toBe("rectangle");
    // 12 ft * 0.3048 = 3.6576 m; 10 ft * 0.3048 = 3.048 m
    expect(res.params.dimensions.lengthM).toBeCloseTo(3.6576, 4);
    expect(res.params.dimensions.widthM).toBeCloseTo(3.048, 4);
    expect(res.params.dimensions.areaSqm).toBeCloseTo(3.6576 * 3.048, 4);
    expect(res.params.elevation).toBe("ground-level");
    expect(res.params.material).toBeNull();
    expect(res.params.features).toEqual([]);
  });

  it("returns 'partial' when width is missing, never inventing a dimension", () => {
    const answers: Answers = { length: 12, heightAccess: ["Elevated"] };
    const res = resolveDeckPreviewParams(answers, MINIMAL_DECK_SCHEMA);
    expect(res.status).toBe("partial");
    if (res.status !== "partial") throw new Error("unreachable");
    expect(res.params.missing).toEqual(["width"]);
    expect(res.params.elevation).toBe("elevated");
  });

  it("returns 'partial' when both dimensions are missing", () => {
    const res = resolveDeckPreviewParams({ heightAccess: [] }, MINIMAL_DECK_SCHEMA);
    expect(res.status).toBe("partial");
    if (res.status !== "partial") throw new Error("unreachable");
    expect(res.params.missing).toEqual(["length", "width"]);
  });

  it("treats the NOT_SURE sentinel on a dimension as missing, not as a number", () => {
    const answers: Answers = { length: NOT_SURE_VALUE, width: 10, heightAccess: [] };
    const res = resolveDeckPreviewParams(answers, MINIMAL_DECK_SCHEMA);
    expect(res.status).toBe("partial");
    if (res.status !== "partial") throw new Error("unreachable");
    expect(res.params.missing).toEqual(["length"]);
  });

  it("treats a non-positive dimension as missing rather than a degenerate rectangle", () => {
    const answers: Answers = { length: 0, width: -5, heightAccess: [] };
    const res = resolveDeckPreviewParams(answers, MINIMAL_DECK_SCHEMA);
    expect(res.status).toBe("partial");
    if (res.status !== "partial") throw new Error("unreachable");
    expect(res.params.missing).toEqual(["length", "width"]);
  });

  it("prioritizes second-story over elevated/ground-level when multiple heightAccess values are selected", () => {
    const answers: Answers = {
      length: 10,
      width: 10,
      heightAccess: ["Ground-level", "Elevated", "Second-story"],
    };
    const res = resolveDeckPreviewParams(answers, MINIMAL_DECK_SCHEMA);
    if (res.status !== "complete") throw new Error("unreachable");
    expect(res.params.elevation).toBe("second-story");
  });

  it("falls back to 'unknown' elevation when heightAccess carries no level signal", () => {
    const answers: Answers = { length: 10, width: 10, heightAccess: ["Access limitations"] };
    const res = resolveDeckPreviewParams(answers, MINIMAL_DECK_SCHEMA);
    if (res.status !== "complete") throw new Error("unreachable");
    expect(res.params.elevation).toBe("unknown");
  });

  it("derives 'stairs' from either the features checkbox or the heightAccess signal", () => {
    const viaFeatures = resolveDeckPreviewParams(
      { length: 10, width: 10, heightAccess: [], features: ["Stairs"] },
      MINIMAL_DECK_SCHEMA,
    );
    const viaHeightAccess = resolveDeckPreviewParams(
      { length: 10, width: 10, heightAccess: ["Stairs required"] },
      MINIMAL_DECK_SCHEMA,
    );
    if (viaFeatures.status !== "complete" || viaHeightAccess.status !== "complete") {
      throw new Error("unreachable");
    }
    expect(viaFeatures.params.features).toEqual(["stairs"]);
    expect(viaHeightAccess.params.features).toEqual(["stairs"]);
  });

  it("maps the 'Railing' feature but omits features with no visual mapping", () => {
    const answers: Answers = {
      length: 10,
      width: 10,
      heightAccess: [],
      features: ["Railing", "Lighting", "Pergola"],
    };
    const res = resolveDeckPreviewParams(answers, MINIMAL_DECK_SCHEMA);
    if (res.status !== "complete") throw new Error("unreachable");
    expect(res.params.features).toEqual(["railing"]);
  });

  it("resolves a chosen material to a stable slug + verbatim label", () => {
    const answers: Answers = {
      length: 10,
      width: 10,
      heightAccess: [],
      desiredMaterial: "Cedar or hardwood",
    };
    const res = resolveDeckPreviewParams(answers, MINIMAL_DECK_SCHEMA);
    if (res.status !== "complete") throw new Error("unreachable");
    expect(res.params.material).toEqual({ key: "cedar-or-hardwood", label: "Cedar or hardwood" });
  });

  it("never invents a material when the visitor said 'Not sure'", () => {
    const answers: Answers = {
      length: 10,
      width: 10,
      heightAccess: [],
      desiredMaterial: "Not sure",
    };
    const res = resolveDeckPreviewParams(answers, MINIMAL_DECK_SCHEMA);
    if (res.status !== "complete") throw new Error("unreachable");
    expect(res.params.material).toBeNull();
  });

  it("returns 'unsupported-shape' when a future shape field reports a non-rectangular value", () => {
    const shapeField: PlaybookField = {
      key: "deckShape",
      label: "Deck shape",
      type: "single_choice",
      desirability: "optional",
      options: [
        { value: "Rectangular", label: "Rectangular" },
        { value: "L-shape", label: "L-shape" },
      ],
    };
    const schema = schemaWithFields([lengthField, widthField, heightAccessField, shapeField]);
    const res = resolveDeckPreviewParams(
      { length: 10, width: 10, heightAccess: [], deckShape: "L-shape" },
      schema,
    );
    expect(res).toEqual({ status: "unsupported-shape", shapeLabel: "L-shape" });
  });

  it("still resolves 'complete' when a shape field exists but reports 'Rectangular'", () => {
    const shapeField: PlaybookField = {
      key: "deckShape",
      label: "Deck shape",
      type: "single_choice",
      desirability: "optional",
      options: [{ value: "Rectangular", label: "Rectangular" }],
    };
    const schema = schemaWithFields([lengthField, widthField, heightAccessField, shapeField]);
    const res = resolveDeckPreviewParams(
      { length: 10, width: 10, heightAccess: [], deckShape: "Rectangular" },
      schema,
    );
    expect(res.status).toBe("complete");
  });

  it("defaults to rectangle when a shape field exists but is unanswered", () => {
    const shapeField: PlaybookField = {
      key: "deckShape",
      label: "Deck shape",
      type: "single_choice",
      desirability: "optional",
      options: [{ value: "Rectangular", label: "Rectangular" }],
    };
    const schema = schemaWithFields([lengthField, widthField, heightAccessField, shapeField]);
    const res = resolveDeckPreviewParams({ length: 10, width: 10, heightAccess: [] }, schema);
    expect(res.status).toBe("complete");
  });

  it("resolves 'complete' against the real, shipped Deck Playbook schema", () => {
    const answers: Answers = {
      length: 16,
      width: 12,
      heightAccess: ["Ground-level"],
      features: ["Railing", "Lighting"],
      desiredMaterial: "Composite",
    };
    const res = resolveDeckPreviewParams(answers, deckPlaybookSchema);
    expect(res.status).toBe("complete");
    if (res.status !== "complete") throw new Error("unreachable");
    expect(res.params.material).toEqual({ key: "composite", label: "Composite" });
    expect(res.params.features).toEqual(["railing"]);
  });

  it("resolves 'partial' against the real Deck Playbook when the visitor only gave totalArea, not length/width", () => {
    const answers: Answers = { totalArea: "about 150 sq ft", heightAccess: ["Ground-level"] };
    const res = resolveDeckPreviewParams(answers, deckPlaybookSchema);
    expect(res.status).toBe("partial");
    if (res.status !== "partial") throw new Error("unreachable");
    expect(res.params.missing).toEqual(["length", "width"]);
  });
});
