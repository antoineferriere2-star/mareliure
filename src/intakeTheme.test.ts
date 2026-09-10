/**
 * L'habillage du tunnel ne sort jamais de sa marque.
 *
 * Le Guided Project Intake est le même runtime pour Métré Build et pour Ma
 * Reliure. Ma Reliure l'habille en redéfinissant, dans le sous-arbre du
 * tunnel, les variables que Tailwind compile dans chaque utilitaire — la
 * palette `stone`, `emerald`, les tokens des composants partagés, le rayon.
 * C'est puissant, donc dangereux : une seule de ces redéfinitions posée sans
 * portée repeindrait l'administration, ou le produit de Métré chez ses clients.
 *
 * Ce test lit la feuille de style plutôt que son rendu. Une fuite de portée ne
 * se voit pas sur Ma Reliure — elle se voit ailleurs, là où personne ne
 * regarde en travaillant sur la reliure.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8").replace(/\r\n/g, "\n");

/** La feuille sans ses commentaires : un sélecteur cité en explication ne compte pas. */
const RULES = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

/** Les blocs de premier niveau `sélecteur { déclarations }`, hors @layer et @media. */
function topLevelRules(css: string): { selector: string; body: string }[] {
  const rules: { selector: string; body: string }[] = [];
  let depth = 0;
  let start = 0;
  let selector = "";
  for (let i = 0; i < css.length; i++) {
    if (css[i] === "{") {
      if (depth === 0) selector = css.slice(start, i).trim();
      if (depth === 0) start = i + 1;
      depth++;
    } else if (css[i] === "}") {
      depth--;
      if (depth === 0) {
        rules.push({ selector, body: css.slice(start, i) });
        start = i + 1;
      }
    } else if (depth === 0 && css[i] === ";") {
      start = i + 1;
    }
  }
  return rules;
}

/**
 * Les sélecteurs d'une liste, découpés aux virgules de premier niveau
 * seulement. La première version coupait à toutes les virgules, y compris
 * celles d'un `:is(.shadow-sm, .shadow)` — et signalait comme fuite une règle
 * parfaitement portée.
 */
function selectorList(selector: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of selector) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else current += char;
  }
  parts.push(current.trim());
  return parts;
}

const REMAPPED = [
  "--color-white",
  "--color-stone-",
  "--color-emerald-",
  "--color-indigo-",
  "--primary:",
  "--accent:",
  "--radius:",
  "--tw-shadow",
];

describe("l'habillage du tunnel reste sous la marque Ma Reliure", () => {
  const rules = topLevelRules(RULES);

  it("ne redéfinit la palette du moteur que sous .brand-mareliure", () => {
    const remaps = rules.filter((rule) => REMAPPED.some((token) => rule.body.includes(token)));
    // Les valeurs d'origine vivent dans :root et .dark, qui sont le thème de
    // Métré lui-même ; tout le reste doit porter la marque.
    const foreign = remaps.filter(
      (rule) =>
        rule.selector !== ":root" &&
        rule.selector !== ".dark" &&
        !rule.selector.startsWith("@") &&
        !selectorList(rule.selector).every((part) => part.startsWith(".brand-mareliure")),
    );
    expect(
      foreign.map((rule) => rule.selector),
      "une redéfinition de palette sans portée de marque",
    ).toEqual([]);
    expect(remaps.some((rule) => rule.selector.startsWith(".brand-mareliure"))).toBe(true);
  });

  it("borne le remappage au sous-arbre du tunnel", () => {
    const palette = rules.find(
      (rule) =>
        rule.selector.startsWith(".brand-mareliure") && rule.body.includes("--color-stone-500"),
    );
    expect(palette?.selector).toBe(".brand-mareliure .intake-surface");
  });

  /**
   * Les valeurs par défaut des tokens de surface sont exactement celles qui
   * étaient écrites en dur dans le runtime. C'est ce qui garantit qu'un
   * déploiement Métré ne bouge pas d'un pixel.
   */
  it("garde pour Métré les surfaces qui étaient en dur", () => {
    const defaults = rules.find(
      (rule) => rule.selector === ":root" && rule.body.includes("--intake-surface"),
    );
    expect(defaults?.body).toContain("--intake-surface: #f7f3ec");
    expect(defaults?.body).toContain("--intake-panel: #ffffff");
  });

  /**
   * Le rouge des erreurs et l'ambre des avertissements portent une
   * signification. Les remapper ferait disparaître une alerte dans la couleur
   * de la marque.
   */
  it("ne touche pas aux couleurs qui signifient quelque chose", () => {
    const branded = rules
      .filter((rule) => rule.selector.startsWith(".brand-mareliure"))
      .map((rule) => rule.body)
      .join("\n");
    expect(branded).not.toMatch(/--color-(rose|red|amber)-/);
  });

  /**
   * L'ombre s'efface par `--tw-shadow`, jamais par `box-shadow: none` sur un
   * élément qui peut recevoir le focus : Tailwind compose l'anneau de focus
   * dans la même propriété.
   */
  it("ne retire pas l'anneau de focus en retirant les ombres", () => {
    const shadowRule = rules.find(
      (rule) => rule.selector.startsWith(".brand-mareliure") && rule.selector.includes(".shadow"),
    );
    expect(shadowRule?.body).toContain("--tw-shadow");
    expect(shadowRule?.body).not.toContain("box-shadow");
  });
});
