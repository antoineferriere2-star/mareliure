import { describe, expect, it } from "vitest";
import { findGlossaryEntries, normalizeForMatch, type GlossaryEntry } from "./glossary";

const glossary: GlossaryEntry[] = [
  { term: "Dos", definition: "d-dos" },
  { term: "Plats", aliases: ["plat"], definition: "d-plats" },
  { term: "Étui", definition: "d-etui" },
  { term: "Plein cuir", definition: "d-plein-cuir" },
  { term: "Nerfs", aliases: ["nerf"], definition: "d-nerfs" },
];
const terms = (texts: string[]) => findGlossaryEntries(texts, glossary).map((entry) => entry.term);

describe("findGlossaryEntries", () => {
  it("finds a word as a whole word", () => {
    expect(terms(["Le dos du livre"])).toEqual(["Dos"]);
  });

  it("does not find a word inside another", () => {
    expect(terms(["Le dossier est complet", "endos", "dosage"])).toEqual([]);
  });

  it("ignores case and accents in both directions", () => {
    expect(terms(["ÉTUI de protection"])).toEqual(["Étui"]);
    expect(terms(["un etui"])).toEqual(["Étui"]);
  });

  it("tolerates a plural s, and honours aliases", () => {
    expect(terms(["les dos abîmés"])).toEqual(["Dos"]);
    expect(terms(["Les plats (les deux faces de la couverture)"])).toEqual(["Plats"]);
    expect(terms(["un plat détaché"])).toEqual(["Plats"]);
    expect(terms(["cinq nerf"])).toEqual(["Nerfs"]);
  });

  it("finds a term written in the singular when the text uses its plural", () => {
    expect(terms(["deux étuis sur mesure"])).toEqual(["Étui"]);
    expect(terms(["un étuis"])).toEqual(["Étui"]);
  });

  it("matches a several-word term as a phrase, not as its parts", () => {
    expect(terms(["Le plein cuir est noble"])).toEqual(["Plein cuir"]);
    expect(terms(["cuir plein de charme"])).toEqual([]);
  });

  it("returns entries in glossary order, each once, however often they appear", () => {
    expect(terms(["étui et dos, dos, dos", "un étui"])).toEqual(["Dos", "Étui"]);
  });

  it("finds a word in any of the texts, and in none of an empty list", () => {
    expect(terms(["rien", "", "le dos"])).toEqual(["Dos"]);
    expect(terms([])).toEqual([]);
    expect(findGlossaryEntries(["le dos"], [])).toEqual([]);
  });

  it("is not fooled by regex characters in a term", () => {
    const odd: GlossaryEntry[] = [{ term: "a.b", definition: "x" }, { term: "  ", definition: "blank" }];
    expect(findGlossaryEntries(["a b", "axb"], odd)).toEqual([]);
    expect(findGlossaryEntries(["voir a.b ici"], odd).map((e) => e.term)).toEqual(["a.b"]);
  });
});

describe("normalizeForMatch", () => {
  it("lowercases and strips diacritics", () => {
    expect(normalizeForMatch("Été, ÉTUI, Œuvre")).toBe("ete, etui, œuvre");
  });
});
