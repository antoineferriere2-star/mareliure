import { createContext, useContext } from "react";
import type { SupportedLocale } from "@/build/i18n";

export const PUBLIC_LOCALE_STORAGE_KEY = "metre-build-public-locale";

export interface PublicLocaleContextValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
}

export const PublicLocaleContext = createContext<PublicLocaleContextValue | null>(null);

export const PUBLIC_LANGUAGE_OPTIONS: Array<{
  locale: SupportedLocale;
  shortLabel: string;
  label: string;
}> = [
  { locale: "en-US", shortLabel: "EN", label: "English" },
  { locale: "es-US", shortLabel: "ES", label: "Español" },
];

export function usePublicLocale() {
  const context = useContext(PublicLocaleContext);
  if (!context) {
    throw new Error("usePublicLocale must be used within PublicLocaleProvider.");
  }
  return context;
}
