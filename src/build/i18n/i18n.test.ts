import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  resolveLocalizedText,
  resolveSupportedLocale,
  t,
  validateEnabledLocales,
} from "./index";

describe("i18n infrastructure", () => {
  it("supports only the initial locales and defaults to en-US", () => {
    expect(DEFAULT_LOCALE).toBe("en-US");
    expect(isSupportedLocale("en-US")).toBe(true);
    expect(isSupportedLocale("es-US")).toBe(true);
    expect(isSupportedLocale("fr-FR")).toBe(false);
    expect(resolveSupportedLocale("fr-FR")).toBe("en-US");
  });

  it("falls back from es-US to en-US without exposing a raw key", () => {
    expect(t("es-US", "marketing.hero.title")).toBe(
      "Turn vague website inquiries into sales-ready project briefs.",
    );
    expect(t("es-US", "marketing.hero.title")).not.toBe("marketing.hero.title");
  });

  it("returns Spanish copy when a translation exists", () => {
    expect(t("es-US", "intake.navigation.next")).toBe("Continuar");
    expect(t("es-US", "brief.provenance.customerProvided")).toBe("Proporcionado por el cliente");
  });

  it("validates enabled_locales as a non-empty unique supported locale array", () => {
    expect(validateEnabledLocales(["en-US", "es-US"])).toEqual(["en-US", "es-US"]);
    expect(() => validateEnabledLocales([])).toThrow("at least one locale");
    expect(() => validateEnabledLocales(["en-US", "en-US"])).toThrow("Duplicate locale");
    expect(() => validateEnabledLocales(["en-US", "fr-FR"])).toThrow("Unsupported locale");
  });

  it("resolves legacy strings and localized text objects", () => {
    expect(resolveLocalizedText("Legacy label", "es-US")).toBe("Legacy label");
    expect(
      resolveLocalizedText({ "en-US": "Budget range", "es-US": "Rango de presupuesto" }, "es-US"),
    ).toBe("Rango de presupuesto");
    expect(resolveLocalizedText({ "en-US": "Budget range" }, "es-US")).toBe("Budget range");
  });
});
