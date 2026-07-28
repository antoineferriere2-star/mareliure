export const SUPPORTED_LOCALES = ["en-US", "es-US"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en-US";

const SUPPORTED_LOCALE_SET = new Set<string>(SUPPORTED_LOCALES);

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === "string" && SUPPORTED_LOCALE_SET.has(value);
}

export function resolveSupportedLocale(
  value: unknown,
  fallback: SupportedLocale = DEFAULT_LOCALE,
): SupportedLocale {
  return isSupportedLocale(value) ? value : fallback;
}

export function fallbackLocale(locale: SupportedLocale): SupportedLocale {
  return locale === DEFAULT_LOCALE ? DEFAULT_LOCALE : DEFAULT_LOCALE;
}

export function validateEnabledLocales(value: unknown): SupportedLocale[] {
  if (!Array.isArray(value)) {
    throw new Error("enabled_locales must be an array.");
  }
  if (value.length === 0) {
    throw new Error("enabled_locales must contain at least one locale.");
  }

  const seen = new Set<SupportedLocale>();
  const locales: SupportedLocale[] = [];
  for (const item of value) {
    if (!isSupportedLocale(item)) {
      throw new Error(`Unsupported locale: ${String(item)}.`);
    }
    if (seen.has(item)) {
      throw new Error(`Duplicate locale: ${item}.`);
    }
    seen.add(item);
    locales.push(item);
  }
  return locales;
}

export type LocalizedText = string | Partial<Record<SupportedLocale, string>>;

export function resolveLocalizedText(value: LocalizedText, locale: SupportedLocale): string {
  if (typeof value === "string") return value;
  return value[locale] ?? value[fallbackLocale(locale)] ?? value[DEFAULT_LOCALE] ?? "";
}
