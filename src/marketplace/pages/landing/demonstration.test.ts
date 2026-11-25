import { describe, expect, it } from "vitest";
import { DEMO_BRIEF, DEMO_CLIENT_STEPS, DEMO_HERO, DEMO_QUOTE } from "./demonstrationContent";
import { MARELIURE_ENTRIES } from "@/marketplace/brand/brandPages";

const TEXT = JSON.stringify({ DEMO_HERO, DEMO_CLIENT_STEPS, DEMO_BRIEF, DEMO_QUOTE });

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
