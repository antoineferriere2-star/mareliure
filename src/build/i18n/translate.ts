import { DEFAULT_LOCALE, type SupportedLocale } from "./locales";
import { enUSMessages, messagesByLocale, type TranslationKey } from "./messages";

type Params = Record<string, string | number>;

function interpolate(template: string, params: Params | undefined): string {
  if (!params) return template;
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    const value = params[key];
    return value === undefined ? match : String(value);
  });
}

export function t(locale: SupportedLocale, key: TranslationKey, params?: Params): string {
  const translated =
    messagesByLocale[locale][key] ?? messagesByLocale[DEFAULT_LOCALE][key] ?? enUSMessages[key];
  return interpolate(translated, params);
}

export function hasTranslation(locale: SupportedLocale, key: TranslationKey): boolean {
  return typeof messagesByLocale[locale][key] === "string";
}
