import { describe, expect, it } from "vitest";
import { DEMO_BRIEF, DEMO_CLIENT_STEPS, DEMO_HERO, DEMO_QUOTE } from "./demonstrationContent";
import { MARELIURE_ENTRIES } from "@/marketplace/brand/brandPages";

// Les valeurs affichées seulement, pas les noms de clés (« lead » est une clé, pas un mot de la page).
function texts(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(texts);
  if (value && typeof value === "object") return Object.values(value).flatMap(texts);
  return [];
}
const TEXT = texts([DEMO_HERO, DEMO_CLIENT_STEPS, DEMO_BRIEF, DEMO_QUOTE]).join(" ");

describe("page Démonstration", () => {
  it("n'affiche aucun montant : un exemple ne se lit jamais comme un tarif", () => {
    expect(TEXT).not.toMatch(/\d\s?(€|euros?|\$)/i);
  });

  it("dit que la fiche d'exemple est fictive", () => {
    expect(DEMO_BRIEF.disclaimer).toMatch(/fictif/i);
    expect(DEMO_QUOTE.caption).toMatch(/fictives/i);
  });

  it("n'emploie aucun mot du vocabulaire interdit", () => {
    expect(TEXT).not.toMatch(/formulaire|questionnaire|\blead\b|utilisateur|prompt/i);
  });

  it("figure au plan du site de Ma Reliure", () => {
    expect(MARELIURE_ENTRIES.map((entry) => entry.path)).toContain("/demonstration");
  });
});
