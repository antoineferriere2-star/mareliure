// The Bookbinding Playbook, exercised against the real schema rather than a
// fixture. Everything here is data, so everything here can rot silently: an
// option value renamed out from under a condition, a step id that no longer
// exists, an `any`/`all` group that reads differently from how it was meant.
// None of that is caught by the type system, and none of it is visible at
// runtime — the branch simply never opens, or the trap never fires.
import { describe, expect, it } from "vitest";
import { evaluatePlaybookConsistency, evaluateStepConsistency } from "@/build/engine/consistency";
import { computeVisibleSteps, getPlaybookPublishIssues } from "@/build/engine/validation";
import { generateProjectBrief } from "@/build/engine/brief";
import { playbookSchema } from "@/build/schema/playbook";
import type { Answers } from "@/build/schema/answers";
import { bookbindingPlaybookSchema } from "./bookbindingPlaybookSchema";

const MISSION = { name: "Mission Reliure" };

/** A complete, valid collector project — the §72 acceptance scenario's answers. */
function collectorAnswers(overrides: Answers = {}): Answers {
  return {
    intention: "collector",
    titre: "Le Comte de Monte-Cristo",
    auteur: "Alexandre Dumas",
    annee: "1953",
    nature: "livre_courant",
    hauteur: 21.8,
    largeur: 14.2,
    epaisseur: 4.8,
    etat: ["couverture_usee"],
    photos: [
      {
        filename: "couverture.jpg",
        sizeBytes: 1200,
        mimeType: "image/jpeg",
        storagePath: "a/1.jpg",
      },
      { filename: "dos.jpg", sizeBytes: 1200, mimeType: "image/jpeg", storagePath: "a/2.jpg" },
    ],
    photosDommages: [
      { filename: "coin.jpg", sizeBytes: 900, mimeType: "image/jpeg", storagePath: "a/3.jpg" },
    ],
    styleSouhaite: "traditionnel",
    materiau: "demi_cuir",
    couleur: "Vert foncé",
    finitions: ["nerfs", "dorure", "titre", "auteur"],
    nerfs: 5,
    valeurRaisons: ["sentimentale"],
    valeurFinanciere: "100_500",
    budget: "250_400",
    delai: "pas_urgent",
    name: "Marie Lefèvre",
    email: "marie@example.com",
    phone: "0601020304",
    localisation: { zip: "75011", city_state: "Paris" },
    consentement: true,
    ...overrides,
  };
}

/** A repair project — the other main branch. */
function repairAnswers(overrides: Answers = {}): Answers {
  return {
    intention: "reparer",
    titre: "Bible familiale",
    nature: "bible_familiale",
    hauteur: 30,
    largeur: 22,
    epaisseur: 8,
    etat: ["dos_abime", "pages_detachees"],
    etatDos: "fendu",
    etatPlats: "uses",
    cahiers: "quelques_uns",
    photos: [
      { filename: "1.jpg", sizeBytes: 1200, mimeType: "image/jpeg", storagePath: "b/1.jpg" },
    ],
    photosDommages: [
      { filename: "2.jpg", sizeBytes: 1200, mimeType: "image/jpeg", storagePath: "b/2.jpg" },
    ],
    valeurRaisons: ["souvenir_familial"],
    valeurFinanciere: "lt_100",
    budget: "150_250",
    delai: "2_3_mois",
    name: "Paul Martin",
    email: "paul@example.com",
    localisation: { zip: "33000", city_state: "Bordeaux" },
    consentement: true,
    ...overrides,
  };
}

describe("the Playbook is publishable as it stands", () => {
  it("parses against the generic Zod schema", () => {
    expect(() => playbookSchema.parse(bookbindingPlaybookSchema)).not.toThrow();
  });

  it("has no publish-blocking issue", () => {
    expect(getPlaybookPublishIssues(playbookSchema.parse(bookbindingPlaybookSchema))).toEqual([]);
  });

  it("keeps the two answer keys build-runtime.ts reads by name", () => {
    // handleSubmitSession copies answers.name / answers.email into
    // build_dossiers.visitor_name / visitor_email. Renaming either key would
    // produce Dossiers with no one to reply to, and nothing would fail loudly.
    const keys = bookbindingPlaybookSchema.sections
      .flatMap((s) => s.steps)
      .flatMap((s) => s.fields)
      .map((f) => f.key);
    expect(keys).toContain("name");
    expect(keys).toContain("email");
  });
});

describe("the intent answer drives which questions are asked", () => {
  function stepIds(answers: Answers): string[] {
    return computeVisibleSteps(bookbindingPlaybookSchema, answers).map((s) => s.step.id);
  }

  it("asks a repair project about the spine, the boards and the sections", () => {
    const ids = stepIds(repairAnswers());
    expect(ids).toContain("diagnostic");
    expect(ids).not.toContain("style");
    expect(ids).not.toContain("finitions");
    expect(ids).not.toContain("inspiration");
  });

  it("asks a collector project about style, finishes and inspiration", () => {
    const ids = stepIds(collectorAnswers());
    expect(ids).toContain("style");
    expect(ids).toContain("finitions");
    expect(ids).toContain("inspiration");
    expect(ids).not.toContain("diagnostic");
  });

  it("asks a re-covering project both, because it is both", () => {
    const ids = stepIds(collectorAnswers({ intention: "couverture" }));
    expect(ids).toContain("diagnostic");
    expect(ids).toContain("style");
  });

  it("asks an undecided visitor only the common questions", () => {
    const ids = stepIds(collectorAnswers({ intention: "ne_sais_pas" }));
    expect(ids).not.toContain("diagnostic");
    expect(ids).not.toContain("style");
    expect(ids).toContain("etat");
    expect(ids).toContain("valeur");
  });

  it("only asks for the number of raised bands once bands are wanted", () => {
    const withBands = computeVisibleSteps(bookbindingPlaybookSchema, collectorAnswers())
      .flatMap((s) => s.visibleFields)
      .map((f) => f.key);
    expect(withBands).toContain("nerfs");

    const withoutBands = computeVisibleSteps(
      bookbindingPlaybookSchema,
      collectorAnswers({ finitions: ["dorure"] }),
    )
      .flatMap((s) => s.visibleFields)
      .map((f) => f.key);
    expect(withoutBands).not.toContain("nerfs");
  });

  it("only asks for close-ups of the damage once a damage is reported", () => {
    const pristine = computeVisibleSteps(
      bookbindingPlaybookSchema,
      collectorAnswers({ etat: ["bon_etat"] }),
    )
      .flatMap((s) => s.visibleFields)
      .map((f) => f.key);
    expect(pristine).not.toContain("photosDommages");
  });
});

describe("a book cannot be in good condition and damaged at once", () => {
  const REACHED = ["intention", "ouvrage", "dimensions", "etat"];

  it("blocks the step", () => {
    const result = evaluateStepConsistency(
      bookbindingPlaybookSchema,
      collectorAnswers({ etat: ["bon_etat", "dos_abime"] }),
      "etat",
      REACHED,
    );
    expect(result.errors.map((r) => r.id)).toEqual(["bookbinding-good-condition-and-damage"]);
  });

  it("says nothing when only one is picked", () => {
    for (const pick of ["bon_etat", "dos_abime", "pages_detachees", "humidite"]) {
      const result = evaluateStepConsistency(
        bookbindingPlaybookSchema,
        collectorAnswers({ etat: [pick] }),
        "etat",
        REACHED,
      );
      expect(result.errors, `${pick} should not error`).toEqual([]);
    }
  });

  it("also blocks 'I don't know' alongside a specific answer", () => {
    const result = evaluateStepConsistency(
      bookbindingPlaybookSchema,
      collectorAnswers({ etat: ["ne_sais_pas", "couverture_usee"] }),
      "etat",
      REACHED,
    );
    expect(result.errors.map((r) => r.id)).toEqual(["bookbinding-unsure-and-specific"]);
  });
});

describe("suspected mould warns without blocking", () => {
  it("is a warning, not an error, and says what to do now", () => {
    const result = evaluateStepConsistency(
      bookbindingPlaybookSchema,
      collectorAnswers({ etat: ["moisissure"] }),
      "etat",
      ["intention", "ouvrage", "dimensions", "etat"],
    );
    expect(result.errors).toEqual([]);
    expect(result.warnings.map((r) => r.id)).toEqual(["bookbinding-mould-handling"]);
    expect(result.warnings[0].message).toContain("isolez");
  });
});

describe("value and timing are read together", () => {
  const REACHED = [
    "intention",
    "ouvrage",
    "dimensions",
    "etat",
    "photos",
    "style",
    "finitions",
    "inspiration",
    "valeur",
    "budget-delai",
  ];

  it("warns when a book worth over 1 000 € is wanted back within a month", () => {
    const result = evaluateStepConsistency(
      bookbindingPlaybookSchema,
      collectorAnswers({ valeurFinanciere: "gt_1000", delai: "moins_1_mois" }),
      "budget-delai",
      REACHED,
    );
    expect(result.warnings.map((r) => r.id)).toContain("bookbinding-valuable-book-rushed");
  });

  it("stays quiet when the same book is not rushed", () => {
    const result = evaluateStepConsistency(
      bookbindingPlaybookSchema,
      collectorAnswers({ valeurFinanciere: "gt_1000", delai: "2_3_mois" }),
      "budget-delai",
      REACHED,
    );
    expect(result.warnings.map((r) => r.id)).not.toContain("bookbinding-valuable-book-rushed");
  });

  it("warns when a collector project is budgeted below what any workshop can do", () => {
    const result = evaluateStepConsistency(
      bookbindingPlaybookSchema,
      collectorAnswers({ budget: "lt_150" }),
      "budget-delai",
      REACHED,
    );
    expect(result.warnings.map((r) => r.id)).toContain("bookbinding-collector-budget-floor");
  });
});

describe("the Project Brief a relieur receives", () => {
  it("reads in words, never in stored values", () => {
    const brief = generateProjectBrief(
      bookbindingPlaybookSchema,
      collectorAnswers(),
      MISSION,
      "2026-09-08T00:00:00.000Z",
    );
    const allLines = [
      ...brief.confirmedInformation,
      ...brief.assumptionsAndCalculated,
      ...brief.constraints,
      ...brief.budgetAndTiming,
    ];
    const values = allLines.map((l) => l.value).join(" | ");
    expect(values).toContain("Demi-cuir");
    expect(values).toContain("250 – 400 €");
    expect(values).not.toContain("demi_cuir");
    expect(values).not.toContain("250_400");
  });

  it("is named after the book", () => {
    const brief = generateProjectBrief(bookbindingPlaybookSchema, collectorAnswers(), MISSION);
    expect(brief.missionName).toBe("Le Comte de Monte-Cristo");
  });

  it("computes the format from the three measurements", () => {
    const brief = generateProjectBrief(bookbindingPlaybookSchema, collectorAnswers(), MISSION);
    const format = brief.assumptionsAndCalculated.find((l) => l.label.startsWith("Format"));
    expect(format?.value).toBe("21.8 × 14.2 × 4.8");
  });

  it("says so, once, when no dimension was given at all", () => {
    const { hauteur: _h, largeur: _l, epaisseur: _e, ...withoutSizes } = collectorAnswers();
    const brief = generateProjectBrief(bookbindingPlaybookSchema, withoutSizes, MISSION);
    expect(brief.missingInformation.map((l) => l.label)).toContain("Dimensions");
  });

  it("keeps the permanent caveats out of 'missing information'", () => {
    // §26: a complete submission must be able to read "Informations
    // manquantes: aucune". Filing the standing caveats there would make that
    // impossible for every Dossier forever, and would keep every Dossier a
    // draft (build-runtime derives its status from this list's length).
    const brief = generateProjectBrief(bookbindingPlaybookSchema, collectorAnswers(), MISSION);
    expect(brief.missingInformation).toEqual([]);
    expect(brief.constraints.map((l) => l.label)).toEqual(
      expect.arrayContaining(["Diagnostic physique", "Prix Ma Reliure"]),
    );
  });

  it("flags a heritage book without ever claiming a diagnosis", () => {
    const brief = generateProjectBrief(
      bookbindingPlaybookSchema,
      repairAnswers({ nature: "manuscrit" }),
      MISSION,
    );
    const line = brief.constraints.find((l) => l.label === "Ouvrage patrimonial");
    expect(line?.value).toContain("validation spécifique par un professionnel");
    expect(brief.suggestedNextAction.value).toContain("restauration et conservation");
  });

  it("routes a book worth over 1 000 € to a human before anything else", () => {
    const brief = generateProjectBrief(
      bookbindingPlaybookSchema,
      collectorAnswers({ valeurFinanciere: "gt_1000" }),
      MISSION,
    );
    expect(brief.constraints.map((l) => l.label)).toContain("Valeur déclarée élevée");
    expect(brief.suggestedNextAction.value).toContain("Revue manuelle obligatoire");
  });

  it("falls back to inviting up to three relieurs on an ordinary project", () => {
    const brief = generateProjectBrief(bookbindingPlaybookSchema, collectorAnswers(), MISSION);
    expect(brief.suggestedNextAction.value).toContain("trois ateliers");
  });

  it("summarises the project in a sentence a person would write", () => {
    const brief = generateProjectBrief(bookbindingPlaybookSchema, collectorAnswers(), MISSION);
    expect(brief.projectSummary).toContain("Créer une édition collector");
    expect(brief.projectSummary).toContain("Le Comte de Monte-Cristo");
    expect(brief.projectSummary).toContain("demi-cuir");
  });

  it("records missing pages as a constraint the relieur must read", () => {
    const brief = generateProjectBrief(
      bookbindingPlaybookSchema,
      repairAnswers({ etat: ["pages_manquantes"] }),
      MISSION,
    );
    expect(brief.constraints.map((l) => l.label)).toContain("Pages manquantes");
  });

  it("produces no consistency error for either complete journey", () => {
    for (const answers of [collectorAnswers(), repairAnswers()]) {
      expect(evaluatePlaybookConsistency(bookbindingPlaybookSchema, answers).errors).toEqual([]);
    }
  });
});
