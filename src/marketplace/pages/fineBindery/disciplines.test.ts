import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FINE_BINDERY_LOCALES } from "@/marketplace/i18n/fineBinderyLocale";
import { FINE_BINDERY_TRANSLATED_SERVICE_KEYS } from "@/marketplace/i18n/fineBinderyGlossary";
import { fineBinderyCopy } from "@/marketplace/i18n/fineBinderyCopy";
import { FINE_BINDERY_ENTRIES } from "@/marketplace/brand/brandPages";
import { FERRIERE_SERVICE_PHOTO_NUMBERS } from "@/marketplace/pages/pricing/ferriereServiceIllustrations";
import { DISCIPLINE_LABELS, DISCIPLINES } from "./disciplines";
import { fineBinderyDisciplineHead } from "./disciplineHead";

describe("les pages par discipline de Fine Bindery", () => {
  it("couvrent les disciplines de l'accueil, dans l'ordre, chacune une fois", () => {
    for (const locale of FINE_BINDERY_LOCALES) expect(DISCIPLINES.map((d) => d.offerIndex)).toEqual(fineBinderyCopy(locale).home.offers.map((_, i) => i));
  });

  it("ont une route statique par discipline", () => {
    for (const d of DISCIPLINES) expect(existsSync(resolve(process.cwd(), `src/routes/$locale.${d.slug}.tsx`)), d.slug).toBe(true);
  });

  it("sont écrites dans les cinq langues, titre ≤ 70 et description ≤ 160 caractères", () => {
    for (const d of DISCIPLINES) for (const locale of FINE_BINDERY_LOCALES) {
      expect(d.seoTitle[locale].length, `${d.slug} ${locale}`).toBeLessThanOrEqual(70);
      expect(d.seoTitle[locale]).toMatch(/— Fine Bindery$/);
      expect(d.seoDescription[locale].length, `${d.slug} ${locale}`).toBeLessThanOrEqual(160);
      expect(d.intro[locale].length, `${d.slug} ${locale}`).toBeGreaterThan(120);
    }
    for (const locale of FINE_BINDERY_LOCALES) expect(Object.values(DISCIPLINE_LABELS[locale]).every(Boolean)).toBe(true);
  });

  it("ne montrent que des prestations traduites et illustrées", () => {
    for (const d of DISCIPLINES) for (const key of d.serviceKeys) {
      expect(FINE_BINDERY_TRANSLATED_SERVICE_KEYS, key).toContain(key);
      expect(key in FERRIERE_SERVICE_PHOTO_NUMBERS, key).toBe(true);
    }
  });

  it("n'annoncent ni montant, ni délai, ni avis", () => {
    const text = JSON.stringify(DISCIPLINES) + JSON.stringify(DISCIPLINE_LABELS);
    expect(text).not.toMatch(/\d+\s*(€|eur|£|\$)|\b\d+\s*(days?|weeks?|months?|jours?|semaines?|mois|tage|wochen|giorni|settimane|días|semanas)\b|review(?!ed)|avis|témoignage|stars?|étoiles/i);
  });

  it("sont au plan du site dans les cinq langues, avec canonique et alternatives hreflang", () => {
    for (const d of DISCIPLINES) for (const locale of FINE_BINDERY_LOCALES) {
      expect(FINE_BINDERY_ENTRIES.map((e) => e.path)).toContain(`/${locale}/${d.slug}`);
      const head = fineBinderyDisciplineHead(locale, d.slug);
      expect(head.links).toContainEqual({ rel: "canonical", href: `https://finebindery.com/${locale}/${d.slug}` });
      expect(head.links.filter((l) => l.rel === "alternate").length).toBeGreaterThanOrEqual(FINE_BINDERY_LOCALES.length);
      const faq = JSON.parse(head.scripts[1].children);
      expect(faq.mainEntity.map((q: { name: string }) => q.name)).toEqual(fineBinderyCopy(locale).home.faq.map((q) => q.question));
    }
  });
});
