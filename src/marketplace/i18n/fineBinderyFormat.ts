import { HTML_LOCALE, type FineBinderyLocale } from "./fineBinderyLocale";

export function formatFineBinderyMoney(cents: number, locale: FineBinderyLocale): string {
  return new Intl.NumberFormat(HTML_LOCALE[locale], {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function formatFineBinderyDate(
  value: string | number | Date,
  locale: FineBinderyLocale,
): string {
  return new Intl.DateTimeFormat(HTML_LOCALE[locale], {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

const PRICE_WORDS: Record<FineBinderyLocale, { manual: string; from: string }> = {
  en: { manual: "On request", from: "From" },
  fr: { manual: "Sur étude", from: "À partir de" },
  de: { manual: "Auf Anfrage", from: "Ab" },
  it: { manual: "Su richiesta", from: "Da" },
  es: { manual: "A consultar", from: "Desde" },
};

export function formatFineBinderyPrice(
  cents: number | null,
  mode: string,
  locale: FineBinderyLocale,
): string {
  const words = PRICE_WORDS[locale];
  if (cents === null) return words.manual;
  const amount = formatFineBinderyMoney(cents, locale);
  return mode === "starting_from" ? `${words.from} ${amount}` : amount;
}
