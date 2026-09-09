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
import { ARTISANS, BEFORE_AFTER, CRAFTS, COMMITMENTS, PROOFS, STEPS } from "./content";
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
  /**
   * Un atelier de vitrine — « Atelier Dupont, Lyon » posé pour meubler la
   * grille — est le mensonge le moins visible et le plus coûteux de la page.
   * On ne peut pas prouver par un test qu'un atelier existe ; on peut exiger
   * que chaque fiche porte les faits qu'un atelier réel fournit lui-même, et
   * qu'aucune n'invente d'ancienneté.
   */
  it("ne référence que des ateliers décrits par des faits vérifiables", () => {
    for (const artisan of ARTISANS) {
      expect(artisan.name.trim().length).toBeGreaterThan(3);
      expect(artisan.city.trim().length).toBeGreaterThan(1);
      expect(artisan.specialties.length).toBeGreaterThan(0);
      if (artisan.since !== undefined) {
        expect(artisan.since).toBeGreaterThan(1800);
        expect(artisan.since).toBeLessThanOrEqual(new Date().getFullYear());
      }
    }
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

  /**
   * Les six besoins n'ont plus de photographie, et c'est le résultat d'une
   * faute : quatre des six étaient illustrés par des images générées. Les
   * remplacer par d'autres images aurait reproduit exactement l'erreur, alors
   * que le titre et la phrase suffisent à faire choisir.
   */
  it("décrit chaque savoir-faire par des mots, pas par une image", () => {
    for (const craft of CRAFTS) {
      expect(craft.body.length).toBeGreaterThan(20);
      expect(craft.detail.length).toBeGreaterThan(20);
      expect(craft).not.toHaveProperty("photo");
    }
  });
});

/**
 * Le garde-fou qui manquait le jour où cinq images générées sont entrées.
 *
 * Elles ne se distinguaient d'une vraie photographie ni par leur type, ni par
 * leur nom, ni par leur déclaration — l'une d'elles était même créditée à un
 * atelier qui ne l'avait pas faite. Un test ne peut pas regarder une image et
 * juger si une presse s'assemble ; il peut en revanche interdire nommément
 * celles qu'on a identifiées, pour qu'un `git revert` distrait ne les
 * réintroduise pas en silence.
 */
describe("les images retirées ne peuvent pas revenir", () => {
  const RETIREES = [
    "mains-dorure",
    "atelier-presse",
    "livre-ancien",
    "reliures-dorees",
    "coffrets-toile",
  ];

  it("n'est plus référencée nulle part dans la landing", () => {
    const sources = [
      readFileSync(resolve(DIR, "landing/photos.ts"), "utf8"),
      readFileSync(resolve(DIR, "landing/content.ts"), "utf8"),
      readFileSync(resolve(DIR, "ReliureLanding.tsx"), "utf8"),
    ].join("\n");
    // Le manifeste explique en commentaire pourquoi elles sont parties ; seul
    // le code compte.
    const code = sources.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const nom of RETIREES) expect(code, `${nom} est de retour`).not.toContain(nom);
  });

  it("n'existe plus sur le disque", () => {
    for (const nom of RETIREES)
      expect(existsSync(resolve(process.cwd(), "public/photos", `${nom}-800.webp`))).toBe(false);
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

  /**
   * Les six univers sont les mêmes mots, dans le même ordre, que les six
   * intentions du Playbook. Un visiteur qui lit « Protéger » sur la page doit
   * retrouver « Le protéger » à la première question du tunnel : c'est ce qui
   * fait qu'il se reconnaît au lieu de recommencer sa réflexion.
   */
  it("porte les six univers, dans l'ordre du tunnel", () => {
    expect(CRAFTS.map((c) => c.title)).toEqual([
      "Réparer",
      "Restaurer",
      "Relier",
      "Embellir",
      "Transformer",
      "Protéger",
    ]);
  });

  it("porte les quatre engagements et les quatre preuves", () => {
    expect(COMMITMENTS).toHaveLength(4);
    expect(PROOFS).toHaveLength(4);
  });

  /**
   * Une photographie qui n'est pas la nôtre doit dire à qui elle est. Sans
   * cela, une pièce d'un autre atelier se lit comme une réalisation de Ma
   * Reliure (§59). Les seules images qui restent sur la page sont celles d'un
   * atelier tiers : elles portent toutes un crédit.
   */
  it("crédite chaque restauration montrée", () => {
    for (const item of BEFORE_AFTER) {
      expect(item.credit.trim().length).toBeGreaterThan(10);
    }
  });

  it("n'ouvre qu'une seule porte : la Mission Métré", () => {
    const chrome = readFileSync(resolve(DIR, "landing/LandingChrome.tsx"), "utf8");
    expect(chrome).toContain('to="/m/$publicToken"');
    // Aucune route inventée : la page ne peut pas envoyer quelqu'un sur un lien mort.
    const routes = SOURCE.match(/to="\/[^"]*"/g) ?? [];
    expect([...new Set(routes)]).toEqual(['to="/m/$publicToken"']);
  });
});
