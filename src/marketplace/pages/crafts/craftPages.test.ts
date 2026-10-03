import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CRAFT_PAGES, COMMON_CRAFT_FAQ, craftFaq } from "./craftPages";
import { CRAFTS } from "@/marketplace/pages/landing/content";
import { WORK_ITEMS } from "@/marketplace/pricing/catalog";
import { PRICE_FACTOR_DETAILS } from "@/marketplace/pages/pricing/priceFactors";
import { FERRIERE_EDITORIAL_CRAFT_KEYS, FERRIERE_SERVICE_PHOTO_NUMBERS } from "@/marketplace/pages/pricing/ferriereServiceIllustrations";
import { craftHead } from "./craftHead";

describe("les pages par besoin de Ma Reliure", () => {
  it("couvrent les six savoir-faire de l'accueil, dans l'ordre, chacun une fois", () => {
    expect(CRAFT_PAGES.map((page) => page.craftIndex)).toEqual(CRAFTS.map((_, index) => index));
  });

  it("ne référencent que des prestations du catalogue, toutes illustrées, sans doublon entre pages", () => {
    const all = CRAFT_PAGES.flatMap((page) => page.itemKeys);
    expect(new Set(all).size).toBe(all.length);
    for (const key of all) {
      expect(WORK_ITEMS.some((item) => item.key === key), key).toBe(true);
      expect(key in FERRIERE_SERVICE_PHOTO_NUMBERS, key).toBe(true);
    }
    expect(all.length).toBe(WORK_ITEMS.length);
  });

  it("ont pour planche de tête une de leurs propres prestations (la grille ne la répète pas)", () => {
    for (const page of CRAFT_PAGES) expect(page.itemKeys).toContain(FERRIERE_EDITORIAL_CRAFT_KEYS[page.craftIndex]);
  });

  it("n'expliquent le prix qu'avec les facteurs de /tarifs", () => {
    for (const page of CRAFT_PAGES) for (const title of page.priceFactorTitles) expect(PRICE_FACTOR_DETAILS.some((f) => f.title === title), title).toBe(true);
  });

  it("ont une route, un titre de 70 caractères au plus et une description de 160 au plus", () => {
    for (const page of CRAFT_PAGES) {
      expect(existsSync(resolve(process.cwd(), `src/routes${page.path}.tsx`)), page.path).toBe(true);
      expect(page.seoTitle.length, page.seoTitle).toBeLessThanOrEqual(70);
      expect(page.seoDescription.length, page.seoDescription).toBeLessThanOrEqual(160);
    }
  });

  it("n'annoncent ni montant (hors forfait transport des CGV), ni délai, ni avis", () => {
    const text = JSON.stringify(CRAFT_PAGES) + JSON.stringify(COMMON_CRAFT_FAQ);
    expect(text.match(/\d+\s*€/g)).toEqual(["100 €", "15 €"]);
    expect(text).not.toMatch(/\b\d+\s*(jours?|semaines?|mois)\b|avis|témoignage|étoiles?|note\s/i);
  });

  it("balisent la FAQ qu'elles affichent, depuis le même tableau", () => {
    for (const page of CRAFT_PAGES) {
      const head = craftHead(page.slug);
      const faq = JSON.parse(head.scripts[1].children);
      expect(faq.mainEntity.map((q: { name: string }) => q.name)).toEqual(craftFaq(page).map((item) => item.question));
      expect(head.links[0]).toEqual({ rel: "canonical", href: `https://mareliure.fr${page.path}` });
    }
  });

  it("sont reliées depuis l'accueil et le pied de page", () => {
    const chrome = readFileSync(resolve(process.cwd(), "src/marketplace/pages/landing/LandingChrome.tsx"), "utf8");
    for (const page of CRAFT_PAGES) expect(chrome).toContain(`href: "${page.path}"`);
    expect(readFileSync(resolve(process.cwd(), "src/marketplace/pages/ReliureLanding.tsx"), "utf8")).toContain("CRAFT_PAGES[index].path");
  });
});
