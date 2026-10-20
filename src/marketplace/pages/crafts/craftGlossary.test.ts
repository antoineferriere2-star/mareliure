import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { ReferenceOperation } from "@/marketplace/reference";
import { CRAFT_GLOSSARY } from "./craftGlossary";
import { CRAFT_PAGES } from "./craftPages";
import { craftHead } from "./craftHead";

const operations = JSON.parse(
  readFileSync(resolve(process.cwd(), "src/marketplace/reference/reliure-fr-v1/operations.json"), "utf8"),
) as ReferenceOperation[];

describe("le vocabulaire de l'atelier des pages par besoin", () => {
  it("recopie mot pour mot le référentiel : opérations actives et visibles du client", () => {
    for (const page of CRAFT_PAGES) {
      const terms = CRAFT_GLOSSARY[page.slug];
      expect(terms.length, page.slug).toBeGreaterThanOrEqual(6);
      expect(new Set(terms.map((t) => t.key)).size, page.slug).toBe(terms.length);
      for (const entry of terms) {
        const op = operations.find((candidate) => candidate.key === entry.key);
        expect(op, entry.key).toBeDefined();
        expect(op!.active && op!.customerVisible, entry.key).toBe(true);
        expect(entry.term).toBe(op!.canonicalName);
        expect(entry.definition).toBe(op!.customerDescription);
      }
    }
  });
  it("n'annonce ni montant, ni délai, ni avis", () => {
    const text = JSON.stringify(CRAFT_GLOSSARY);
    expect(text).not.toMatch(/\d+\s*€|\b\d+\s*(jours?|semaines?|mois)\b|avis|témoignage/i);
  });
  it("balise le vocabulaire affiché, depuis le même tableau", () => {
    for (const page of CRAFT_PAGES) {
      const set = JSON.parse(craftHead(page.slug).scripts[2].children);
      expect(set["@type"]).toBe("DefinedTermSet");
      expect(set.url).toBe(`https://mareliure.fr${page.path}`);
      expect(set.hasDefinedTerm.map((t: { name: string }) => t.name)).toEqual(CRAFT_GLOSSARY[page.slug].map((t) => t.term));
    }
  });
});
