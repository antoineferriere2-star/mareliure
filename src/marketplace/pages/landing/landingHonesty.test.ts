/**
 * La landing n'a pas le droit d'inventer.
 *
 * C'est la contrainte la plus explicite du brief (§59) et la plus facile à
 * perdre : une note « 4,9/5 », un « déjà 200 livres restaurés » ou un atelier
 * d'exemple laissé dans le code se glissent en une ligne, se remarquent en
 * production, et coûtent la confiance qu'on met des mois à construire — sur un
 * site où l'on demande à quelqu'un de nous confier un objet auquel il tient.
 *
 * Ces tests lisent les sources de la page. Ils ne prouvent pas que la page est
 * belle ; ils prouvent qu'elle ne ment pas.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ARTISANS, BEFORE_AFTER, CRAFTS, COMMITMENTS, STEPS } from "./content";

const DIR = resolve(process.cwd(), "src/marketplace/pages");
const FILES = [
  "ReliureLanding.tsx",
  "landing/content.ts",
  "landing/LandingChrome.tsx",
  "landing/ArtisanCard.tsx",
  "landing/Photograph.tsx",
];

/**
 * Le code sans ses commentaires.
 *
 * Les commentaires de ces fichiers énoncent la règle — « pas de note, pas
 * d'avis, pas de compteur » — et un scan naïf les prend pour l'infraction
 * qu'ils interdisent. Un test qui hurle sur sa propre documentation finit
 * désactivé ; on ne lit donc que ce que la page peut réellement afficher.
 *
 * Les `//` sont retirés seulement en début de ligne, pour ne pas amputer une
 * URL au passage.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

const SOURCE = FILES.map((f) => withoutComments(readFileSync(resolve(DIR, f), "utf8"))).join("\n");

/**
 * Les tournures qui n'ont de sens que si un chiffre réel existe derrière.
 *
 * Volontairement étroites : « 3 ateliers » est une règle produit vraie
 * (MAX_BINDERS_PER_CASE), pas une preuve sociale, et un test qui la
 * signalerait serait désactivé au deuxième faux positif.
 */
const FABRICATION_PATTERNS: readonly { label: string; pattern: RegExp }[] = [
  { label: "une note sur 5", pattern: /\d\s*[,.]?\d*\s*\/\s*5\b/ },
  { label: "des étoiles", pattern: /★|étoiles?\b/i },
  { label: "des avis", pattern: /\bavis\b|témoignages?\b|verbatims?\b/i },
  { label: "une note moyenne", pattern: /note\s+moyenne|moyenne\s+de\s+\d/i },
  { label: "une certification", pattern: /certifi(é|ée|és|ées|cation)\b|labellis/i },
  {
    label: "un compteur de clients ou de réalisations",
    pattern:
      /\b\d[\d\s.,]*\s*(?:\+\s*)?(?:clients?|livres\s+restaur|projets?\s+réalis|reliures?\s+réalis)/i,
  },
  { label: "un tarif fixe", pattern: /à\s+partir\s+de\s+\d|\d\s*€/i },
];

describe("la landing Ma Reliure ne fabrique rien", () => {
  it("n'affiche aucun atelier tant qu'aucun n'est réel", () => {
    expect(ARTISANS).toHaveLength(0);
  });

  it("n'affiche aucune réalisation avant / après tant qu'aucune n'est réelle", () => {
    expect(BEFORE_AFTER).toHaveLength(0);
  });

  it.each(FABRICATION_PATTERNS)("ne contient pas $label", ({ pattern }) => {
    const hit = SOURCE.match(pattern);
    expect(hit?.[0] ?? null).toBeNull();
  });
});

describe("les emplacements de photographie s'annoncent comme provisoires", () => {
  it("porte une mention explicite plutôt qu'un cadre vide", () => {
    const photograph = readFileSync(resolve(DIR, "landing/Photograph.tsx"), "utf8");
    expect(photograph).toContain("Photographie à fournir");
  });

  it("décrit la prise de vue attendue pour chaque savoir-faire", () => {
    for (const craft of CRAFTS) {
      expect(craft.shotBrief.length).toBeGreaterThan(20);
    }
  });
});

describe("la page dit bien ce que le brief demande", () => {
  it("tient en trois étapes, pas six", () => {
    expect(STEPS).toHaveLength(3);
  });

  it("porte les quatre savoir-faire et les quatre engagements", () => {
    expect(CRAFTS.map((c) => c.title)).toEqual([
      "Réparer",
      "Restaurer",
      "Transformer",
      "Créer une édition collector",
    ]);
    expect(COMMITMENTS).toHaveLength(4);
  });

  it("n'ouvre qu'une seule porte : la Mission Métré", () => {
    const chrome = readFileSync(resolve(DIR, "landing/LandingChrome.tsx"), "utf8");
    expect(chrome).toContain('to="/m/$publicToken"');
    // Aucune route inventée : la page ne peut pas envoyer quelqu'un sur un lien mort.
    const routes = SOURCE.match(/to="\/[^"]*"/g) ?? [];
    expect([...new Set(routes)]).toEqual(['to="/m/$publicToken"']);
  });
});
