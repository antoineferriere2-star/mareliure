import { describe, expect, it } from "vitest";
import { WORK_ITEMS } from "@/marketplace/pricing/catalog";
import { fineBinderyCopy } from "./fineBinderyCopy";
import { FINE_BINDERY_LOCALES, fineBinderyAlternates, fineBinderyProfilePath, replaceFineBinderyLocale } from "./fineBinderyLocale";
import { FINE_BINDERY_TRANSLATED_SERVICE_KEYS, languageName, serviceName, specialtyName } from "./fineBinderyGlossary";
import { formatFineBinderyMoney, formatFineBinderyPrice } from "./fineBinderyFormat";
import { EN_BOOKBINDING_COPY } from "@/build/pages/public/enBookbindingCopy";
import { DE_FINE_BINDERY_COPY, ES_ES_FINE_BINDERY_COPY, IT_FINE_BINDERY_COPY } from "@/build/pages/public/fineBinderyEuropeanCopy";
import { publicCopy } from "@/build/pages/public/publicLocaleContext";

describe("FineBindery European i18n", () => {
  it("formats EUR with the active regional convention", () => {
    expect(formatFineBinderyMoney(123450, "de")).toContain("1.234,50");
    expect(formatFineBinderyMoney(123450, "en")).toContain("1,234.50");
    expect(formatFineBinderyPrice(null, "manual_review", "it")).toBe("Su richiesta");
  });
  it("publishes exactly the five Phase 1 locales with English as x-default", () => {
    expect(FINE_BINDERY_LOCALES).toEqual(["en", "fr", "de", "it", "es"]);
    const alternates = fineBinderyAlternates("atelier-martin");
    expect(alternates).toHaveLength(6);
    expect(alternates.at(-1)).toEqual({ locale: "x-default", href: "https://finebindery.com/en/atelier-martin" });
  });

  it("keeps the current page and stable slug when the locale changes", () => {
    expect(replaceFineBinderyLocale("/de/atelier-martin", "it")).toBe("/it/atelier-martin");
    expect(fineBinderyProfilePath("es", "atelier-martin")).toBe("/es/atelier-martin");
  });

  it("has real public copy for every locale", () => {
    for (const locale of FINE_BINDERY_LOCALES) {
      const copy = fineBinderyCopy(locale);
      expect(copy.home.title.length).toBeGreaterThan(20);
      expect(copy.home.offers).toHaveLength(4);
      expect(copy.home.steps).toHaveLength(6);
      expect(copy.home.faq.length).toBeGreaterThanOrEqual(4);
      expect(copy.profile.discuss).not.toMatch(/TODO_TRANSLATE|Google Translate/i);
    }
  });

  it("translates all 45 commercial services without changing their keys", () => {
    expect(WORK_ITEMS).toHaveLength(45);
    expect(new Set(FINE_BINDERY_TRANSLATED_SERVICE_KEYS)).toEqual(new Set(WORK_ITEMS.map((item) => item.key)));
    for (const item of WORK_ITEMS) for (const locale of FINE_BINDERY_LOCALES) expect(serviceName(item.key, locale), `${item.key}/${locale}`).toBeTruthy();
  });

  it("localizes structured language and specialty labels", () => {
    expect(languageName("de", "de")).toBe("Deutsch");
    expect(languageName("de", "it")).toBe("Tedesco");
    expect(specialtyName("plein_cuir", "es")).toBe("Plena piel");
  });

  it("does not silently fall back to English in the European book journey", () => {
    const allowedIdentical = {
      "de-DE": new Set(["Matière", "Nom"]),
      "it-IT": new Set(["150 – 250 €", "250 – 400 €", "400 – 700 €"]),
      "es-ES": new Set(["Matière"]),
    };
    const dictionaries = {
      "de-DE": DE_FINE_BINDERY_COPY,
      "it-IT": IT_FINE_BINDERY_COPY,
      "es-ES": ES_ES_FINE_BINDERY_COPY,
    };

    for (const [locale, dictionary] of Object.entries(dictionaries)) {
      const unchanged = Object.entries(EN_BOOKBINDING_COPY)
        .filter(([key, english]) => key !== english && dictionary[key] === english)
        .map(([key]) => key);
      expect(new Set(unchanged), locale).toEqual(allowedIdentical[locale as keyof typeof allowedIdentical]);
    }

    for (const locale of ["de-DE", "it-IT", "es-ES"] as const) {
      for (const text of [
        "Please check the following before continuing:",
        "Project sent",
        "Your project summary is ready",
        "Still to confirm",
        "What happens next",
        '"{field}" is required.',
      ]) expect(publicCopy(locale, text), `${locale}: ${text}`).not.toBe(text);
    }
  });
});
