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
    <div
      role="group"
      aria-label="Choose site language"
      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 p-1 shadow-sm"
    >
      <Languages className="ml-1.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      {PUBLIC_LANGUAGE_OPTIONS.map((option) => {
        const active = option.locale === locale;
        return (
          <button
            key={option.locale}
            type="button"
            aria-pressed={active}
            onClick={() => setLocale(resolveSupportedLocale(option.locale))}
            className={
              "rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide transition " +
              (active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {option.shortLabel}
          </button>
        );
      })}
    </div>
  );
}

