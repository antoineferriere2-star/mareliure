export const FINE_BINDERY_LOCALES = ["en", "fr", "de", "it", "es"] as const;
export type FineBinderyLocale = (typeof FINE_BINDERY_LOCALES)[number];

export const DEFAULT_FINE_BINDERY_LOCALE: FineBinderyLocale = "en";
export const FINE_BINDERY_LOCALE_STORAGE_KEY = "finebindery-locale";

const LOCALES = new Set<string>(FINE_BINDERY_LOCALES);

export function isFineBinderyLocale(value: unknown): value is FineBinderyLocale {
  return typeof value === "string" && LOCALES.has(value);
}

export function resolveFineBinderyLocale(value: unknown): FineBinderyLocale {
  return isFineBinderyLocale(value) ? value : DEFAULT_FINE_BINDERY_LOCALE;
}

export function suggestedFineBinderyLocale(language: string | null | undefined): FineBinderyLocale {
  const candidate = language?.trim().toLowerCase().split(/[-_]/)[0];
  return resolveFineBinderyLocale(candidate);
}

export const HTML_LOCALE: Record<FineBinderyLocale, string> = {
  en: "en-GB",
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
  es: "es-ES",
};

export const ENGINE_LOCALE: Record<FineBinderyLocale, "en-US" | "fr-FR" | "de-DE" | "it-IT" | "es-ES"> = {
  en: "en-US",
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
  es: "es-ES",
};

export function fineBinderyHomePath(locale: FineBinderyLocale): string {
  return `/${locale}`;
}

export function fineBinderyDirectoryPath(locale: FineBinderyLocale): string {
  return `/${locale}/professionals`;
}

export function fineBinderyProfilePath(locale: FineBinderyLocale, slug: string): string {
  return `/${locale}/${slug}`;
}

export function fineBinderyProjectPath(locale: FineBinderyLocale, slug?: string): string {
  const params = slug ? `?ref=${encodeURIComponent(slug)}&source=finebindery_profile` : "";
  return `/${locale}/project${params}`;
}

export function replaceFineBinderyLocale(pathname: string, locale: FineBinderyLocale): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length > 0 && isFineBinderyLocale(parts[0])) parts[0] = locale;
  else parts.unshift(locale);
  return `/${parts.join("/")}`;
}

export function fineBinderyAlternates(pathWithoutLocale = ""): Array<{ locale: FineBinderyLocale | "x-default"; href: string }> {
  const suffix = pathWithoutLocale ? `/${pathWithoutLocale.replace(/^\/+/, "")}` : "";
  return [
    ...FINE_BINDERY_LOCALES.map((locale) => ({ locale, href: `https://finebindery.com/${locale}${suffix}` })),
    { locale: "x-default" as const, href: `https://finebindery.com/en${suffix}` },
  ];
}
