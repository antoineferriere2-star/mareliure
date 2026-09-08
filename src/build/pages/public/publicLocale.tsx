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

/**
 * `lockedLocale` lets a surface declare the language it is written in — today,
 * a Mission whose Playbook is authored in one language (see
 * `MissionProposal.defaultLocale`). It is a generic capability, not a rule
 * about any particular vertical: nothing here knows which Playbook is French.
 *
 * The lock deliberately does NOT write to localStorage. A visitor who opens a
 * French intake and later browses the marketing site must find it in the
 * language they chose, not in the one an embedded page imposed on them.
 */
export function PublicLocaleProvider({
  children,
  lockedLocale,
}: {
  children: ReactNode;
  lockedLocale?: SupportedLocale | null;
}) {
  const [preferredLocale, setLocaleState] = useState<SupportedLocale>(DEFAULT_LOCALE);
  const locked = Boolean(lockedLocale);
  const locale = lockedLocale ?? preferredLocale;

  useEffect(() => {
    setLocaleState(resolveSupportedLocale(window.localStorage.getItem(PUBLIC_LOCALE_STORAGE_KEY)));
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    // Only the visitor's own choice is persisted. A locked surface leaves the
    // stored preference exactly as it found it.
    if (locked) return;
    window.localStorage.setItem(PUBLIC_LOCALE_STORAGE_KEY, preferredLocale);
  }, [locked, preferredLocale]);

  const value = useMemo<PublicLocaleContextValue>(
    () => ({
      locale,
      setLocale: (nextLocale) => setLocaleState(resolveSupportedLocale(nextLocale)),
      locked,
    }),
    [locale, locked],
  );

  return <PublicLocaleContext.Provider value={value}>{children}</PublicLocaleContext.Provider>;
}

export function PublicLanguageSelect() {
  const { locale, setLocale, locked } = usePublicLocale();

  // A surface that dictates its own language has no switcher: offering EN/ES
  // on a French intake would show two buttons that change nothing.
  if (locked) return null;

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
