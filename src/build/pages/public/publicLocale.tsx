import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Languages } from "lucide-react";
import { DEFAULT_LOCALE, resolveSupportedLocale, type SupportedLocale } from "@/build/i18n";
import {
  PUBLIC_LANGUAGE_OPTIONS,
  PUBLIC_LOCALE_STORAGE_KEY,
  PublicLocaleContext,
  usePublicLocale,
  type PublicLocaleContextValue,
} from "@/build/pages/public/publicLocaleContext";

export function PublicLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(DEFAULT_LOCALE);

  useEffect(() => {
    setLocaleState(resolveSupportedLocale(window.localStorage.getItem(PUBLIC_LOCALE_STORAGE_KEY)));
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem(PUBLIC_LOCALE_STORAGE_KEY, locale);
  }, [locale]);

  const value = useMemo<PublicLocaleContextValue>(
    () => ({
      locale,
      setLocale: (nextLocale) => setLocaleState(resolveSupportedLocale(nextLocale)),
    }),
    [locale],
  );

  return <PublicLocaleContext.Provider value={value}>{children}</PublicLocaleContext.Provider>;
}

export function PublicLanguageSelect() {
  const { locale, setLocale } = usePublicLocale();

  return (
    <label className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950">
      <Languages className="h-4 w-4 text-slate-500" aria-hidden="true" />
      <span className="sr-only">Choose site language</span>
      <select
        aria-label="Choose site language"
        value={locale}
        onChange={(event) => setLocale(resolveSupportedLocale(event.target.value))}
        className="bg-transparent text-sm font-semibold tracking-normal outline-none"
      >
        {PUBLIC_LANGUAGE_OPTIONS.map((option) => (
          <option key={option.locale} value={option.locale}>
            {option.shortLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
