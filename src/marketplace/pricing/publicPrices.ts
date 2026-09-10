/**
 * Ce que la page publique a le droit d'afficher.
 *
 * Une seule source : le Pricebook, tarif validé par Ma Reliure
 * (`ADMIN_VALIDATED`), coché « public » par un humain. Jamais le benchmark web
 * — ni son minimum, ni sa référence, ni son maximum — et jamais une référence
 * initiale non validée.
 *
 * La séparation tient au type autant qu'à la règle : cette fonction ne reçoit
 * que des `PricebookEntry`, et la ligne rendue ne porte aucune rémunération.
 */
import { WORK_ITEMS, workItem, workItemLabel } from "./catalog";
import type { PricebookEntry } from "./pricebook";
import type { PricingMode } from "./pricingModes";
import { isPublicProvenance } from "./provenance";

export interface PublicPriceRow {
  workItemKey: string;
  label: string;
  mode: Exclude<PricingMode, "MANUAL_REVIEW">;
  priceTtcCents: number;
}

export function isPublicEntry(entry: PricebookEntry): boolean {
  return (
    entry.status === "published" &&
    isPublicProvenance(entry.provenance) &&
    entry.validatedAt !== null &&
    entry.publicVisible &&
    entry.pricingMode !== "MANUAL_REVIEW" &&
    entry.priceTtcCents !== null &&
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
      mode: entry.pricingMode as Exclude<PricingMode, "MANUAL_REVIEW">,
      priceTtcCents: entry.priceTtcCents!,
    }))
    .sort((a, b) => (ORDER.get(a.workItemKey) ?? 0) - (ORDER.get(b.workItemKey) ?? 0));
}

/** Un prix public, écrit comme on le lit : « 350,00 € », « à partir de 120,00 € ». */
export function formatPublicPrice(
  row: PublicPriceRow,
  formatEuros: (cents: number) => string,
): string {
  const amount = formatEuros(row.priceTtcCents);
  return row.mode === "STARTING_FROM" ? `à partir de ${amount}` : amount;
}
