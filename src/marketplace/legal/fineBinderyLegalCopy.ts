import type { FineBinderyLocale } from "../i18n/fineBinderyLocale";
import { FINE_BINDERY_LEGAL_TRANSLATIONS } from "./fineBinderyLegalTranslations";
import type { FineBinderyLegalSlug } from "./fineBinderyLegalPaths";
export const EN_LEGAL_META: Record<FineBinderyLegalSlug, { title: string; description: string }> = {
  "legal-notice": {
    title: "Legal Notice",
    description: "Who publishes Fine Bindery, and where the site is hosted.",
  },
  "privacy-policy": {
    title: "Privacy Policy",
    description:
      "What we do with the information you give us when presenting your book, and how to stay in control of it.",
  },
  "terms-of-use": {
    title: "Terms of Use",
    description: "What you can expect from the site, and what it does not yet commit to.",
  },
  "terms-of-sale": {
    title: "Terms of Sale",
    description: "What governs your order, from the moment a price is confirmed for your project.",
  },
};
export function fineBinderyLegalMeta(locale: FineBinderyLocale, slug: FineBinderyLegalSlug) {
  return locale === "en"
    ? EN_LEGAL_META[slug]
    : FINE_BINDERY_LEGAL_TRANSLATIONS[locale].pages[slug];
}
