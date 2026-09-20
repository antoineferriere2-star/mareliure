// The guidance Ma Reliure adds around the intake is data keyed to the Playbook.
// These tests are the tie between the two: a renamed field, a removed view or a
// glossary word no step uses any more must fail here rather than quietly show
// nothing to a visitor.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { findGlossaryEntries } from "@/build/engine/glossary";
import { computeVisibleSteps } from "@/build/engine/validation";
import { bookbindingPlaybookSchema as playbook } from "@/build/playbooks/bookbindingPlaybookSchema";
import {
  RELIURE_GLOSSARY,
  RELIURE_INTAKE_MINUTES,
  RELIURE_PHOTO_SHOTS,
  RELIURE_REPLY_DELAY,
} from "./reliureIntakeGuidance";

const fields = playbook.sections.flatMap((section) => section.steps.flatMap((step) => step.fields));

/** Every visitor-facing string of a step, as MissionRuntime feeds the glossary. */
function stepText(step: { title: string; why?: string; fields: typeof fields }): string[] {
  return [
    step.title,
    step.why ?? "",
    ...step.fields.flatMap((field) => [
      field.label,
      field.helpText ?? "",
      ...(("options" in field ? field.options : []) ?? []).flatMap((option) => [
        option.label,
        option.reassurance ?? "",
      ]),
    ]),
  ];
}
const allSteps = playbook.sections.flatMap((section) => section.steps);

describe("photo views", () => {
  it("only guide fields that exist in the Playbook and that are photo fields", () => {
    for (const key of Object.keys(RELIURE_PHOTO_SHOTS)) {
      const field = fields.find((f) => f.key === key);
      expect(field, `no field "${key}"`).toBeDefined();
      expect(field!.type).toBe("photo");
    }
  });

  it("guides a view for the cover, the spine, the page edges and the main damage — nothing more", () => {
    expect(RELIURE_PHOTO_SHOTS.photos.map((s) => s.key)).toEqual(["couverture", "dos", "tranche"]);
    expect(RELIURE_PHOTO_SHOTS.photosDommages.map((s) => s.key)).toEqual(["dommage_principal"]);
  });

  it("never asks for more views than the field can hold", () => {
    for (const [key, shots] of Object.entries(RELIURE_PHOTO_SHOTS)) {
      const field = fields.find((f) => f.key === key);
      if (field?.type === "photo") expect(shots.length).toBeLessThanOrEqual(field.maxFiles);
    }
  });

  it("has unique keys, a hint and an illustration that is really served", () => {
    const seen = new Set<string>();
    for (const shots of Object.values(RELIURE_PHOTO_SHOTS)) {
      for (const shot of shots) {
        expect(seen.has(shot.key), `duplicate view key ${shot.key}`).toBe(false);
        seen.add(shot.key);
        expect(shot.label.length).toBeGreaterThan(0);
        expect(shot.hint.length).toBeGreaterThan(10);
        expect(shot.exampleSrc).toMatch(/^\/photo-guide\/[a-z]+\.svg$/);
        expect(existsSync(resolve(process.cwd(), "public", shot.exampleSrc!.slice(1))), shot.exampleSrc).toBe(true);
      }
    }
  });

  it("only guides the damage view where the Playbook only asks for damage photos", () => {
    const damage = fields.find((f) => f.key === "photosDommages")!;
    expect(damage.displayWhen).toBeDefined();
    // With a book in good condition the damage field is not shown at all.
    const good = computeVisibleSteps(playbook, { intention: "reparer", etat: ["bon_etat"] });
    expect(good.flatMap((s) => s.visibleFields).some((f) => f.key === "photosDommages")).toBe(false);
  });
});

describe("glossary", () => {
  it("has no word that no step of the Playbook uses", () => {
    const texts = allSteps.flatMap((step) => stepText(step));
    const found = findGlossaryEntries(texts, RELIURE_GLOSSARY).map((entry) => entry.term);
    expect(RELIURE_GLOSSARY.map((e) => e.term).filter((term) => !found.includes(term))).toEqual([]);
  });

  it("explains each word in one plain sentence, once", () => {
    const terms = RELIURE_GLOSSARY.map((entry) => entry.term);
    expect(new Set(terms).size).toBe(terms.length);
    for (const entry of RELIURE_GLOSSARY) {
      expect(entry.definition.length).toBeGreaterThan(15);
      expect(entry.definition.endsWith(".")).toBe(true);
    }
  });

  it("puts the diagnostic words under the diagnostic step and design words under the finishes", () => {
    const termsFor = (id: string) =>
      findGlossaryEntries(stepText(allSteps.find((s) => s.id === id)!), RELIURE_GLOSSARY).map((e) => e.term);
    expect(termsFor("diagnostic")).toEqual(expect.arrayContaining(["Dos", "Plats", "Cahiers"]));
    expect(termsFor("finitions")).toEqual(expect.arrayContaining(["Nerfs", "Gardes", "Dorure", "Étui"]));
    expect(termsFor("finitions")).not.toContain("Cahiers");
    // A step about the visitor's own details has nothing to explain.
    expect(termsFor("contact")).toEqual([]);
  });

  it("explains the trade words the first question's own options use (an étui, plein cuir)", () => {
    expect(findGlossaryEntries(stepText(allSteps.find((s) => s.id === "intention")!), RELIURE_GLOSSARY).map((e) => e.term)).toEqual(
      expect.arrayContaining(["Étui", "Plein cuir", "Demi-cuir"]),
    );
  });
});

describe("the figures the intake states", () => {
  it("announces the same five minutes the Mission already tells visitors", () => {
    expect(RELIURE_INTAKE_MINUTES).toBe(5);
  });

  it("keeps the indicative delay a plain, non-contractual phrase", () => {
    expect(RELIURE_REPLY_DELAY).toMatch(/jours ouvrés/);
  });
});
