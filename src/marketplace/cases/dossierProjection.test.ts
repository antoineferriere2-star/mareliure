// The one door between Métré's Dossier and the marketplace. Its job is as much
// about what it withholds as about what it shows: an invited relieur who has
// not been chosen must never see a customer's e-mail (§55).
import { describe, expect, it } from "vitest";
import { generateProjectBrief } from "@/build/engine/brief";
import { bookbindingPlaybookSchema } from "@/build/playbooks/bookbindingPlaybookSchema";
import type { Answers } from "@/build/schema/answers";
import { buildCaseProfile } from "./caseProfile";
import { projectCase } from "./dossierProjection";

const ANSWERS: Answers = {
  intention: "belle_reliure",
  titre: "Le Comte de Monte-Cristo",
  auteur: "Alexandre Dumas",
  nature: "livre_courant",
  hauteur: 21.8,
  largeur: 14.2,
  epaisseur: 4.8,
  etat: ["couverture_usee"],
  photos: [
    { filename: "couverture.jpg", sizeBytes: 900, mimeType: "image/jpeg", storagePath: "x/1.jpg" },
  ],
  styleSouhaite: "traditionnel",
  materiau: "demi_cuir",
  valeurRaisons: ["sentimentale"],
  valeurFinanciere: "100_500",
  budget: "250_400",
  delai: "pas_urgent",
  name: "Marie Lefèvre",
  email: "marie@example.com",
  phone: "0601020304",
  localisation: { zip: "75011", city_state: "Paris" },
  consentement: true,
};

function view(disclosure: "full" | "project_only") {
  return projectCase({
    reference: "RL-001",
    brief: generateProjectBrief(bookbindingPlaybookSchema, ANSWERS, { name: "Mission Reliure" }),
    profile: buildCaseProfile(ANSWERS),
    disclosure,
    photos: [{ url: "https://signed.example/1.jpg", caption: "couverture.jpg" }],
    manualReviewRequired: false,
  });
}

describe("what an invited relieur sees", () => {
  const relieur = view("project_only");

  it("gets the project and the photos", () => {
    expect(relieur.title).toBe("Le Comte de Monte-Cristo");
    expect(relieur.project.map((l) => l.label)).toContain("Matière");
    expect(relieur.photos).toHaveLength(1);
  });

  /**
   * Cette attente était l'inverse tant que l'atelier chiffrait : le budget du
   * client était alors ce qu'il devait viser. Dans le modèle géré, Ma Reliure
   * fixe le prix et propose une rémunération — le budget annoncé ne sert plus
   * qu'à reconstituer la marge, et à faire juger une offre à l'aune d'un
   * chiffre qui n'est pas celui de l'atelier.
   */
  it("ne voit pas le budget annoncé par le client", () => {
    expect(relieur.budgetAndTiming.map((l) => l.label)).not.toContain("Budget envisagé");
  });

  it("garde le délai souhaité, qui est une contrainte de travail", () => {
    expect(relieur.budgetAndTiming.map((l) => l.label)).toContain("Délai souhaité");
  });

  it("gets the town, because a book has to be shipped somewhere", () => {
    expect(relieur.area).toBe("Paris");
  });

  it("never gets the customer's name, e-mail, phone or address", () => {
    expect(relieur.contact).toBeNull();
    const everything = JSON.stringify(relieur);
    expect(everything).not.toContain("marie@example.com");
    expect(everything).not.toContain("Marie Lefèvre");
    expect(everything).not.toContain("0601020304");
    expect(everything).not.toContain("75011");
  });

  it("keeps each line's provenance, so an AI hypothesis is never read as a fact", () => {
    for (const line of relieur.project) {
      expect(typeof line.source).toBe("string");
    }
  });
});

describe("what the admin, or the chosen relieur, sees", () => {
  const full = view("full");

  it("includes the contact details", () => {
    expect(full.contact).toEqual({
      name: "Marie Lefèvre",
      email: "marie@example.com",
      phone: "0601020304",
      location: "75011 Paris",
    });
  });

  it("still carries the same project lines", () => {
    expect(full.project.map((l) => l.label)).toContain("Matière");
  });

  /** L'admin fixe le prix : le budget annoncé est une de ses entrées. */
  it("garde le budget annoncé, qui informe la décision de prix", () => {
    expect(full.budgetAndTiming.map((l) => l.label)).toContain("Budget envisagé");
  });
});

describe("the view degrades rather than breaking", () => {
  it("falls back to the reference when the book has no title at all", () => {
    const answers: Answers = { ...ANSWERS, titre: "" };
    const projected = projectCase({
      reference: "RL-042",
      brief: {
        ...generateProjectBrief(bookbindingPlaybookSchema, answers, { name: "" }),
        missionName: "",
      },
      profile: buildCaseProfile(answers),
      disclosure: "project_only",
      photos: [],
      manualReviewRequired: true,
    });
    expect(projected.title).toBe("RL-042");
    expect(projected.manualReviewRequired).toBe(true);
  });
});
