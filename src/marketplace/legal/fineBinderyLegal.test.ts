import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FINE_BINDERY_LOCALES,
  HTML_LOCALE,
  fineBinderyLanguageHref,
} from "../i18n/fineBinderyLocale";
import { fineBinderyLocalizedHead } from "../i18n/fineBinderySeo";
import { fineBinderyLegalMeta } from "./fineBinderyLegalCopy";
import { FINE_BINDERY_LEGAL_SLUGS, fineBinderyLegalPath } from "./fineBinderyLegalPaths";
import { FINE_BINDERY_LEGAL_TRANSLATIONS } from "./fineBinderyLegalTranslations";
import { FineBinderyLegalPage } from "../pages/legal/FineBinderyLegalPage";
import { FINE_BINDERY_ENTRIES } from "../brand/brandPages";
import { canonicalRedirectUrl } from "../brand/wwwRedirect";
import { MARELIURE_PUBLISHER, MARELIURE_CONTACT_EMAIL } from "./legalEntity";
vi.mock("../i18n/FineBinderyLanguageSwitch", () => ({
  FineBinderyLanguageSwitch: () => null,
  useFineBinderyDocumentLocale: vi.fn(),
}));

const pageHtml = (
  locale: (typeof FINE_BINDERY_LOCALES)[number],
  slug: (typeof FINE_BINDERY_LEGAL_SLUGS)[number],
) => renderToStaticMarkup(createElement(FineBinderyLegalPage, { locale, slug }));
describe("Fine Bindery — documents légaux dans cinq langues", () => {
  it("rend toutes les clauses et tous les paragraphes anglais dans chaque traduction", () => {
    for (const slug of FINE_BINDERY_LEGAL_SLUGS) {
      const english = pageHtml("en", slug).split('<nav aria-label="Other legal information"')[0];
      for (const locale of ["fr", "de", "it", "es"] as const) {
        const translated = pageHtml(locale, slug).split(
          `<nav aria-label="${FINE_BINDERY_LEGAL_TRANSLATIONS[locale].other}"`,
        )[0];
        expect((translated.match(/<h2\b/g) ?? []).length, `${locale}/${slug}`).toBe(
          (english.match(/<h2\b/g) ?? []).length,
        );
        expect((translated.match(/<p\b/g) ?? []).length, `${locale}/${slug}`).toBe(
          (english.match(/<p\b/g) ?? []).length,
        );
        expect(translated).not.toMatch(/{{|undefined|TODO/);
      }
    }
  });
  it("conserve identité, faits, chiffres et réserves de revue, sans médiateur inventé", () => {
    for (const locale of FINE_BINDERY_LOCALES) {
      const notice = pageHtml(locale, "legal-notice");
      for (const value of [
        MARELIURE_PUBLISHER.name,
        MARELIURE_PUBLISHER.siren,
        MARELIURE_PUBLISHER.siret,
        MARELIURE_PUBLISHER.vat,
        MARELIURE_CONTACT_EMAIL,
      ])
        expect(notice).toContain(value);
      const sales = pageHtml(locale, "terms-of-sale");
      expect(sales.match(/LEGAL REVIEW REQUIRED/g)).toHaveLength(3);
      expect(sales).toContain("BLOCKED — MEDIATOR DETAILS REQUIRED");
      for (const number of ["100", "500", "35", "25", "8", "15", "14", "3", "30"])
        expect(sales).toContain(number);
      expect(pageHtml(locale, "privacy-policy")).toContain("90");
    }
  });
  it("publie vingt titres/descriptions uniques et des ensembles hreflang réciproques", () => {
    const titles = new Set<string>(),
      descriptions = new Set<string>();
    for (const slug of FINE_BINDERY_LEGAL_SLUGS)
      for (const locale of FINE_BINDERY_LOCALES) {
        const page = fineBinderyLegalMeta(locale, slug);
        const head = fineBinderyLocalizedHead(locale, {
          title: `${page.title} — Fine Bindery`,
          description: page.description,
          pathWithoutLocale: slug,
        });
        titles.add(page.title);
        descriptions.add(page.description);
        expect(HTML_LOCALE[locale]).toBeTruthy();
        const canonical = `https://finebindery.com/${locale}/${slug}`;
        expect(head.links.find((l) => l.rel === "canonical")?.href).toBe(canonical);
        const alternates = head.links.filter((l) => l.rel === "alternate");
        expect(alternates).toHaveLength(6);
        for (const target of FINE_BINDERY_LOCALES)
          expect(alternates).toContainEqual({
            rel: "alternate",
            hrefLang: target,
            href: `https://finebindery.com/${target}/${slug}`,
          });
        expect(alternates).toContainEqual({
          rel: "alternate",
          hrefLang: "x-default",
          href: `https://finebindery.com/en/${slug}`,
        });
        expect(
          FINE_BINDERY_ENTRIES.some((e) => e.path === fineBinderyLegalPath(locale, slug)),
        ).toBe(true);
        const html = pageHtml(locale, slug);
        for (const sibling of FINE_BINDERY_LEGAL_SLUGS)
          expect(html).toContain(`href="/${locale}/${sibling}"`);
        for (const target of FINE_BINDERY_LOCALES)
          expect(fineBinderyLanguageHref(`/${locale}/${slug}`, "?from=test", target)).toBe(
            `/${target}/${slug}?from=test`,
          );
      }
    expect(titles.size).toBe(20);
    expect(descriptions.size).toBe(20);
  });
  it("redirige les anciennes URL anglaises vers la version canonique en un saut", () => {
    for (const slug of FINE_BINDERY_LEGAL_SLUGS) {
      expect(FINE_BINDERY_ENTRIES.some((e) => e.path === `/${slug}`)).toBe(false);
      expect(canonicalRedirectUrl(`http://www.mareliure.fr/${slug}?x=1`)).toBe(
        `https://finebindery.com/en/${slug}?x=1`,
      );
    }
  });
});
