import { describe, expect, it } from "vitest";
import { UNIT_NONE, UNIT_OTHER, initialUnitChoice, resolveUnit, unitOptions, validateServiceForm, type ServiceFormValues } from "./serviceForm";
import { REFERENCE_UNITS } from "./units";

const values = (over: Partial<ServiceFormValues> = {}): ServiceFormValues => ({ name: "Dorure titre", unitChoice: "titre", customUnit: "", price: "45", favorite: false, description: "", ...over });

describe("les unités proposées", () => {
  it("les unités habituelles de l'opération d'abord (dans l'ordre), puis le reste du vocabulaire — sans doublon", () => {
    const { usual, others } = unitOptions(["titre", "ligne"]);
    expect(usual.map((u) => u.key)).toEqual(["titre", "ligne"]);
    expect(others.map((u) => u.key)).not.toContain("titre");
    expect(usual.length + others.length).toBe(REFERENCE_UNITS.length);
  });

  it("une unité candidate inconnue du vocabulaire est ignorée, jamais inventée", () => {
    expect(unitOptions(["titre", "par palette"]).usual.map((u) => u.key)).toEqual(["titre"]);
  });

  it("le choix de départ : la première unité habituelle, sinon « aucune »", () => {
    expect(initialUnitChoice(["cahier", "ouvrage"])).toBe("cahier");
    expect(initialUnitChoice([])).toBe(UNIT_NONE);
  });
});

describe("l'unité reste ouverte", () => {
  it("le vocabulaire propose, « Autre » saisit n'importe quelle unité, « Aucune » n'en met pas", () => {
    expect(resolveUnit({ unitChoice: "titre", customUnit: "ignorée" })).toBe("titre");
    expect(resolveUnit({ unitChoice: UNIT_OTHER, customUnit: "  séance de dorure  " })).toBe("séance de dorure");
    expect(resolveUnit({ unitChoice: UNIT_OTHER, customUnit: "   " })).toBeNull();
    expect(resolveUnit({ unitChoice: UNIT_NONE, customUnit: "ignorée" })).toBeNull();
  });
});

describe("validation : le prix n'est JAMAIS prérempli, et jamais deviné", () => {
  it("un prix vide est une erreur — pas un zéro silencieux", () => {
    const r = validateServiceForm(values({ price: "" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems.join(" ")).toMatch(/prix/i);
    expect(validateServiceForm(values({ price: "   " })).ok).toBe(false);
  });

  it("0 est accepté quand l'atelier le dit (« 0 si c'est offert »)", () => {
    const r = validateServiceForm(values({ price: "0" }));
    expect(r.ok && r.unitPriceCents).toBe(0);
  });

  it("lit 45, 45,50 et 45.5 en centimes ; refuse le texte et les négatifs", () => {
    for (const [text, cents] of [["45", 4500], ["45,50", 4550], ["45.5", 4550], [" 1 200 ", 120000]] as const) {
      const r = validateServiceForm(values({ price: text }));
      expect(r.ok && r.unitPriceCents, text).toBe(cents);
    }
    for (const bad of ["abc", "-3", "12 €€ x", "1e3", "10000000"]) expect(validateServiceForm(values({ price: bad })).ok, bad).toBe(false);
    // Le montant est arrondi au centime par la saisie commune (12,345 → 12,35), pas refusé.
    const rounded = validateServiceForm(values({ price: "12,345" }));
    expect(rounded.ok && rounded.unitPriceCents).toBe(1235);
  });

  it("un nom est requis ; « Autre » sans texte est refusé ; une unité trop longue aussi", () => {
    expect(validateServiceForm(values({ name: "   " })).ok).toBe(false);
    expect(validateServiceForm(values({ unitChoice: UNIT_OTHER, customUnit: "" })).ok).toBe(false);
    expect(validateServiceForm(values({ unitChoice: UNIT_OTHER, customUnit: "x".repeat(41) })).ok).toBe(false);
  });

  it("le résultat porte le nom et l'unité de l'ATELIER, la description nulle si vide", () => {
    const r = validateServiceForm(values({ name: "  Mon titrage  ", unitChoice: UNIT_OTHER, customUnit: "ligne dorée", price: "52", description: "  " }));
    expect(r).toEqual({ ok: true, name: "Mon titrage", unit: "ligne dorée", unitPriceCents: 5200, description: null });
  });
});
