// The marketplace's read-contract over the Bookbinding Playbook. These tests
// exist for one failure mode: someone renames an option value in the Playbook,
// nothing breaks at compile time, and manual review quietly stops firing on
// thousand-euro books. A rename must break here instead.
import { describe, expect, it } from "vitest";
import { bookbindingPlaybookSchema } from "@/build/playbooks/bookbindingPlaybookSchema";
import type { PlaybookField } from "@/build/schema/playbook";
import { CASE_ANSWER_KEYS, CASE_ANSWER_VALUES, buildCaseProfile } from "./caseProfile";

const FIELDS: PlaybookField[] = bookbindingPlaybookSchema.sections
  .flatMap((section) => section.steps)
  .flatMap((step) => step.fields);

function field(key: string): PlaybookField {
  const found = FIELDS.find((f) => f.key === key);
  if (!found) throw new Error(`No field "${key}" in the Bookbinding Playbook.`);
  return found;
}

function optionValues(key: string): string[] {
  const f = field(key);
  if ("options" in f) return f.options.map((option) => option.value);
  if (f.type === "budget") return (f.ranges ?? []).map((range) => range.value);
  throw new Error(`Field "${key}" has no options.`);
}

describe("every key the marketplace reads still exists in the Playbook", () => {
  it.each(Object.entries(CASE_ANSWER_KEYS))("%s -> %s", (_name, key) => {
    expect(FIELDS.map((f) => f.key)).toContain(key);
  });
});

describe("every option value the marketplace branches on still exists", () => {
  const cases: Array<[string, string, Record<string, string>]> = [
    ["intent", CASE_ANSWER_KEYS.intent, CASE_ANSWER_VALUES.intent],
    ["nature", CASE_ANSWER_KEYS.nature, CASE_ANSWER_VALUES.nature],
    ["condition", CASE_ANSWER_KEYS.condition, CASE_ANSWER_VALUES.condition],
    ["material", CASE_ANSWER_KEYS.material, CASE_ANSWER_VALUES.material],
    ["finishes", CASE_ANSWER_KEYS.finishes, CASE_ANSWER_VALUES.finishes],
    ["style", CASE_ANSWER_KEYS.style, CASE_ANSWER_VALUES.style],
    ["declaredValue", CASE_ANSWER_KEYS.declaredValue, CASE_ANSWER_VALUES.declaredValue],
    ["budget", CASE_ANSWER_KEYS.budget, CASE_ANSWER_VALUES.budget],
  ];

  /**
   * Une valeur peut cesser d'être proposée sans cesser d'exister : elle reste
   * dans les réponses déjà données. `couverture` en est là depuis la refonte
   * des univers publics — neuf dossiers le portent, et le domaine doit
   * continuer de savoir le lire.
   *
   * Ce que ce test protège n'est donc pas « le Playbook offre encore cette
   * valeur », mais « le Playbook n'a renommé aucune valeur sur laquelle la
   * marketplace s'accroche ». Les retraits sont déclarés ici, un par un : en
   * ajouter un doit être un geste conscient, pas un effet de bord.
   */
  const RETIRED_VALUES: ReadonlySet<string> = new Set([CASE_ANSWER_VALUES.intent.recover]);

  it.each(cases)("%s", (_name, key, values) => {
    const declared = optionValues(key);
    for (const value of Object.values(values)) {
      if (RETIRED_VALUES.has(value)) continue;
      expect(declared, `${key} should offer "${value}"`).toContain(value);
    }
  });

  it("les valeurs retirées ne sont plus proposées, mais restent connues du domaine", () => {
    const declaredIntents = optionValues(CASE_ANSWER_KEYS.intent);
    for (const retired of RETIRED_VALUES) {
      expect(declaredIntents).not.toContain(retired);
      expect(Object.values(CASE_ANSWER_VALUES.intent)).toContain(retired);
    }
  });
});

describe("buildCaseProfile", () => {
  it("derives the skills a half-leather collector project actually needs", () => {
    const profile = buildCaseProfile({
      intention: "collector",
      materiau: "demi_cuir",
      finitions: ["nerfs", "dorure", "etui"],
      styleSouhaite: "traditionnel",
      nature: "livre_courant",
    });
    expect(profile.requiredSkills).toEqual(["cartonnage", "demi_cuir", "dorure"]);
    expect(profile.heritage).toBe(false);
  });

  it("adds restoration and conservation for a heritage book, whatever else was asked", () => {
    const profile = buildCaseProfile({ intention: "belle_reliure", nature: "manuscrit" });
    expect(profile.requiredSkills).toEqual(["conservation", "restauration"]);
    expect(profile.heritage).toBe(true);
  });

  it("turns a budget band into cents, and leaves it null when the visitor did not commit", () => {
    expect(buildCaseProfile({ budget: "250_400" })).toMatchObject({
      budgetMinCents: 25_000,
      budgetMaxCents: 40_000,
    });
    expect(buildCaseProfile({ budget: "gt_700" })).toMatchObject({
      budgetMinCents: 70_000,
      budgetMaxCents: null,
    });
    expect(buildCaseProfile({ budget: "ne_sais_pas" })).toMatchObject({
      budgetMinCents: null,
      budgetMaxCents: null,
    });
  });

  it("reads the town and postcode out of the address answer", () => {
    const profile = buildCaseProfile({ localisation: { zip: "75011", city_state: "Paris" } });
    expect(profile.city).toBe("Paris");
    expect(profile.postalCode).toBe("75011");
  });

  it("survives an empty or malformed answer set without throwing", () => {
    expect(() => buildCaseProfile({})).not.toThrow();
    const profile = buildCaseProfile({ localisation: "pas un objet", finitions: "pas une liste" });
    expect(profile.city).toBeNull();
    expect(profile.finishes).toEqual([]);
    expect(profile.requiredSkills).toEqual([]);
  });

  it("notices suspected mould", () => {
    expect(buildCaseProfile({ etat: ["moisissure", "dos_abime"] }).mouldSuspected).toBe(true);
    expect(buildCaseProfile({ etat: ["dos_abime"] }).mouldSuspected).toBe(false);
  });
});
