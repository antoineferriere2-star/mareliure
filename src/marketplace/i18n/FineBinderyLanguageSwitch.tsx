import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";
import {
  FINE_BINDERY_LOCALES,
  FINE_BINDERY_LOCALE_STORAGE_KEY,
  HTML_LOCALE,
  fineBinderyLanguageHref,
  type FineBinderyLocale,
} from "./fineBinderyLocale";

export function useFineBinderyDocumentLocale(locale: FineBinderyLocale) {
  useEffect(() => {
    document.documentElement.lang = HTML_LOCALE[locale];
    window.localStorage.setItem(FINE_BINDERY_LOCALE_STORAGE_KEY, locale);
  }, [locale]);
}

export function FineBinderyLanguageSwitch({ locale, label }: { locale: FineBinderyLocale; label: string }) {
  const { pathname, searchStr } = useLocation();
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-1 text-[0.68rem] font-semibold tracking-[0.08em]">
      {FINE_BINDERY_LOCALES.map((candidate) => (
        <a
          key={candidate}
          href={fineBinderyLanguageHref(pathname, searchStr, candidate)}
          hrefLang={candidate}
          lang={candidate}
          aria-current={candidate === locale ? "page" : undefined}
          onClick={() => window.localStorage.setItem(FINE_BINDERY_LOCALE_STORAGE_KEY, candidate)}
          className={`inline-flex min-h-9 min-w-9 items-center justify-center rounded-full px-2 transition ${candidate === locale ? "bg-mr-ink text-mr-paper" : "text-mr-graphite hover:bg-mr-rule/40 hover:text-mr-ink"}`}
        >
          {candidate.toUpperCase()}
        </a>
      ))}
    </nav>
  );
}
