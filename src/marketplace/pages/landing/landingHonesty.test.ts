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
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ARTISANS, BEFORE_AFTER, CRAFTS, COMMITMENTS, STEPS } from "./content";
import { PHOTOS } from "./photos";

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

  /**
   * Les deux restaurations affichées ont été faites par un atelier tiers. Sans
   * crédit visible, la section les présenterait implicitement comme des
   * chantiers Ma Reliure — la fabrication exacte que le brief interdit. Le
   * crédit est donc obligatoire, au même titre que les photographies.
   */
  it("crédite chaque restauration à l'atelier qui l'a faite", () => {
    for (const entry of BEFORE_AFTER) {
      expect(entry.credit.trim().length).toBeGreaterThan(10);
      expect(entry.before.src).toMatch(/^\/photos\//);
      expect(entry.after.src).toMatch(/^\/photos\//);
    }
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

  it("décrit ce que montre la photographie de chaque savoir-faire", () => {
    for (const craft of CRAFTS) {
      expect(craft.alt.length).toBeGreaterThan(20);
    }
  });
});

/**
 * Une image manquante ne casse rien de bruyant : elle laisse un cadre vide sur
 * une page qui vend un savoir-faire visuel, et personne ne s'en aperçoit avant
 * un client. On vérifie donc que chaque fichier déclaré existe vraiment, et
 * chaque largeur promise avec lui.
 */
describe("chaque photographie déclarée existe sur le disque", () => {
  const PUBLIC = resolve(process.cwd(), "public");

  const declared = Object.entries(PHOTOS).flatMap(([slot, photo]) =>
    photo.srcSet.split(", ").map((entry) => ({ slot, path: entry.split(" ")[0] })),
  );

  it("déclare au moins une photographie par emplacement", () => {
    expect(declared.length).toBeGreaterThanOrEqual(Object.keys(PHOTOS).length);
  });

  it.each(declared)("$slot : $path", ({ path }) => {
    expect(existsSync(resolve(PUBLIC, path.replace(/^\//, "")))).toBe(true);
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
