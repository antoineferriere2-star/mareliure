/**
 * Euro display for an integer cents amount.
 *
 * `locale` defaults to the French convention ("1 234,56 €") — every existing
 * caller is an admin or atelier screen, which stays French regardless of a
 * case's brand (§44). A customer-facing Fine Bindery screen passes "en-US"
 * explicitly for "€1,234.56" — the currency itself (EUR) does not change,
 * only how the same amount is written.
 */
export function formatEuros(cents: number, locale: "fr-FR" | "en-US" = "fr-FR"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(cents / 100);
}
