/**
 * Ce que la page publique a le droit d'afficher.
 *
 * Une seule source : le Pricebook, entrée publiée, cochée « publique » par un
 * humain. Ni les grilles des ateliers — c'est ce que nous payons, pas ce que
 * nous vendons — ni le benchmark web, qui n'est qu'un repère.
 *
 * La séparation tient au type autant qu'à la règle : cette fonction ne reçoit
 * que des `PricebookEntry`. Un `PriceBenchmark` ne peut pas lui être passé, et
 * la ligne rendue ne porte aucune rémunération.
 *
 * Publier un prix au Pricebook ne le rend pas public. Ce sont deux gestes :
 * arrêter un prix pour vendre, et choisir de l'annoncer.
 */
import {
  WORK_ITEMS,
  workItem,
  workItemLabel,
  type ComplexityClass,
  type SizeClass,
} from "./catalog";
import { PRICEBOOK_PROVENANCE, type PricebookEntry } from "./pricebook";
import type { PricingMode } from "./pricingModes";
import { isPublicProvenance } from "./provenance";
import { fromHt } from "./vat";

export interface PublicPriceRow {
  workItemKey: string;
  label: string;
  sizeClass: SizeClass;
  complexityClass: ComplexityClass;
  mode: Exclude<PricingMode, "MANUAL_REVIEW">;
  unitLabel: string | null;
  priceTtcCents: number;
  priceTtcHighCents: number | null;
}

export function isPublicEntry(entry: PricebookEntry): boolean {
  return (
    isPublicProvenance(PRICEBOOK_PROVENANCE) &&
    entry.status === "published" &&
    entry.validatedAt !== null &&
    entry.publicVisible &&
    entry.pricingMode !== "MANUAL_REVIEW" &&
    entry.customerPriceTtcCents !== null &&
    workItem(entry.workItemKey)?.requiresStudy !== true
  );
}

const ORDER = new Map(WORK_ITEMS.map((item, index) => [item.key, index]));

export function publicPriceRows(entries: readonly PricebookEntry[]): PublicPriceRow[] {
  return entries
    .filter(isPublicEntry)
    .map((entry) => ({
      workItemKey: entry.workItemKey,
      label: workItemLabel(entry.workItemKey),
      sizeClass: entry.sizeClass,
      complexityClass: entry.complexityClass,
      mode: entry.pricingMode as Exclude<PricingMode, "MANUAL_REVIEW">,
      unitLabel: entry.unitLabel,
      priceTtcCents: entry.customerPriceTtcCents!,
      priceTtcHighCents:
        entry.pricingMode === "RANGE" && entry.priceHtHighCents !== null
          ? fromHt(entry.priceHtHighCents, entry.vatRateBps).ttcCents
          : null,
    }))
    .sort(
      (a, b) =>
        (ORDER.get(a.workItemKey) ?? 0) - (ORDER.get(b.workItemKey) ?? 0) ||
        a.sizeClass.localeCompare(b.sizeClass),
    );
}

/** Un prix public, écrit comme on le lit : « à partir de 120 € », « 8 € par fleuron ». */
export function formatPublicPrice(
  row: PublicPriceRow,
  formatEuros: (cents: number) => string,
): string {
  const amount = formatEuros(row.priceTtcCents);
  switch (row.mode) {
    case "RANGE":
      return row.priceTtcHighCents !== null
        ? `${amount} – ${formatEuros(row.priceTtcHighCents)}`
        : amount;
    case "STARTING_FROM":
      return `à partir de ${amount}`;
    case "PER_UNIT":
    case "PER_HOUR":
      return row.unitLabel ? `${amount} ${row.unitLabel}` : amount;
    default:
      return amount;
  }
}
