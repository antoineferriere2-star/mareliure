import type { FineBinderyLocale } from "../i18n/fineBinderyLocale";
export const FINE_BINDERY_LEGAL_SLUGS = [
  "legal-notice",
  "privacy-policy",
  "terms-of-use",
  "terms-of-sale",
] as const;
export type FineBinderyLegalSlug = (typeof FINE_BINDERY_LEGAL_SLUGS)[number];
export function fineBinderyLegalPath(
  locale: FineBinderyLocale,
  slug: FineBinderyLegalSlug,
): string {
  return `/${locale}/${slug}`;
}
