/**
 * Le benchmark web : ce que notre recherche initiale a trouvé en ligne.
 *
 * Une ligne par opération, en euros TTC : un minimum, un maximum, et une
 * **référence web** au milieu. Les sources — tarifs publics d'ateliers, Etsy
 * pour le rebind — sont trop peu nombreuses et trop dispersées (gamme, format,
 * état, matières, complexité, temps) pour parler de moyenne du marché : la
 * référence est le milieu de la fourchette observée, arrondi aux 5 €, et elle
 * sert à initialiser la grille Ma Reliure.
 *
 * Trois interdits, tenus par le code :
 *
 * - jamais public : `publicPrices.ts` ne reçoit que des entrées de Pricebook ;
 * - jamais un prix : une fois le tarif Ma Reliure fixé, le moteur ne lit plus
 *   le benchmark, il lit le Pricebook ;
 * - jamais recalculé tout seul : modifier une fourchette ne déplace aucun prix.
 */

export const PRICING_UNITS = ["per_book", "per_hour"] as const;
export type PricingUnit = (typeof PRICING_UNITS)[number];

export interface WebBenchmark {
  workItemKey: string;
  webMinCents: number | null;
  /** La valeur centrale de départ. `null` quand aucun montant n'est assez fiable. */
  webReferenceCents: number | null;
  webMaxCents: number | null;
  pricingUnit: PricingUnit;
  /** « 400 €+ » : le haut observé n'est pas un plafond. */
  openEndedMax: boolean;
  sourceSummary: string | null;
  researchedAt: string | null;
  notes: string | null;
}

/** L'arrondi de la référence web : le milieu de la fourchette, aux 5 € près. */
export const WEB_REFERENCE_ROUNDING_CENTS = 500;

/** La référence web qu'implique une fourchette observée. */
export function webReferenceFromRange(minCents: number, maxCents: number): number {
  return (
    Math.round((minCents + maxCents) / 2 / WEB_REFERENCE_ROUNDING_CENTS) *
    WEB_REFERENCE_ROUNDING_CENTS
  );
}

export function unitSuffix(unit: PricingUnit): string {
  return unit === "per_hour" ? "/h" : "";
}

/** « 250 € – 450 € », « 100 € – 400 €+ », « 85 €/h », « — ». */
export function formatWebRange(
  benchmark: WebBenchmark | null,
  formatEuros: (cents: number) => string,
): string {
  if (!benchmark) return "—";
  const suffix = unitSuffix(benchmark.pricingUnit);
  const { webMinCents: min, webMaxCents: max, webReferenceCents: reference } = benchmark;
  if (min !== null && max !== null)
    return `${formatEuros(min)} – ${formatEuros(max)}${benchmark.openEndedMax ? "+" : ""}${suffix}`;
  if (reference !== null) return `${formatEuros(reference)}${suffix}`;
  return "—";
}
