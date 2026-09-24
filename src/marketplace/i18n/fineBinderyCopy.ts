import type { FineBinderyLocale } from "./fineBinderyLocale";
import { en } from "./locales/en";
import { fr } from "./locales/fr";
import { de } from "./locales/de";
import { it } from "./locales/it";
import { es } from "./locales/es";

export const FINE_BINDERY_COPY = { en, fr, de, it, es } as const;

export function fineBinderyCopy(locale: FineBinderyLocale) {
  return FINE_BINDERY_COPY[locale];
}
