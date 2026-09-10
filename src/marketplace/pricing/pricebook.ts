/**
 * Le Pricebook Ma Reliure : la seule source de prix du moteur.
 *
 * Une entrée en vigueur par opération, au format et à la complexité courants —
 * les écarts passent par les modificateurs globaux, pas par des lignes
 * supplémentaires. Chaque changement écrit une nouvelle version et retire la
 * précédente : l'historique dit quel prix valait quel jour, et les dossiers
 * déjà validés gardent leur photographie.
 *
 * Deux états en vigueur :
 *
 * - `draft` : la référence web initiale, provenance `WEB_REFERENCE_INITIAL`.
 *   Le simulateur l'utilise ; un dossier ne la promet pas sans décision ;
 * - `published` : un prix validé par Ma Reliure, provenance `ADMIN_VALIDATED`.
 *
 * Le prix est décidé **TTC** — c'est ainsi qu'il se compare au web et qu'un
 * particulier le paie. Le HT en est déduit par `vat.ts` et porte la marge.
 */
import type { GridProvenance } from "./provenance";
import type { PricingMode } from "./pricingModes";

export const PRICEBOOK_STATUSES = ["draft", "published", "retired"] as const;
export type PricebookStatus = (typeof PRICEBOOK_STATUSES)[number];

export interface PricebookEntry {
  id: string;
  workItemKey: string;
  pricingMode: PricingMode;
  /** Déduit du TTC. `null` sur étude. */
  priceHtCents: number | null;
  /** Le tarif Ma Reliure. `null` sur étude. */
  priceTtcCents: number | null;
  vatRateBps: number;
  status: PricebookStatus;
  provenance: GridProvenance;
  version: number;
  publicVisible: boolean;
  validatedAt: string | null;
  validatedBy: string | null;
  createdAt: string;
  createdBy: string | null;
  changeReason: string | null;
  notes: string | null;
}

export function isActiveEntry(entry: PricebookEntry): boolean {
  return entry.status === "draft" || entry.status === "published";
}

/** L'entrée en vigueur d'une opération, validée ou non. */
export function activeEntry(
  entries: readonly PricebookEntry[],
  workItemKey: string,
): PricebookEntry | null {
  return entries.find((entry) => entry.workItemKey === workItemKey && isActiveEntry(entry)) ?? null;
}

/** Toutes les versions d'une opération, de la plus récente à la plus ancienne. */
export function pricebookHistory(
  entries: readonly PricebookEntry[],
  workItemKey: string,
): PricebookEntry[] {
  return entries
    .filter((entry) => entry.workItemKey === workItemKey)
    .sort((a, b) => b.version - a.version);
}
