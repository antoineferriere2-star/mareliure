/**
 * Tout ce qu'il faut pour chiffrer, chargé en une fois.
 *
 * La grille d'administration, le simulateur, la composition et la validation
 * d'un dossier lisent exactement les mêmes données de la même façon. Un
 * simulateur plus indulgent que la validation montrerait un prix que le
 * dossier refuserait.
 */
import type { Supa } from "@/build/services/adminAuth.server";
import type { PricingGrid } from "@/marketplace/pricing/composition";
import type { PricingModifier } from "@/marketplace/pricing/modifiers";
import type { PayoutPolicy } from "@/marketplace/pricing/payout";
import { isActiveEntry, type PricebookEntry } from "@/marketplace/pricing/pricebook";
import type { WorkItemState } from "@/marketplace/pricing/pricingGrid";
import { STANDARD_VAT_RATE_BPS } from "@/marketplace/pricing/vat";
import type { WebBenchmark } from "@/marketplace/pricing/webBenchmark";
import {
  loadModifiers,
  loadPricebook,
  loadPricingPolicy,
  loadWebBenchmarks,
  loadWorkItemRows,
} from "./pricingRepository.server";

export interface PricingData {
  workItems: WorkItemState[];
  benchmarks: WebBenchmark[];
  /** Toutes les versions de la grille, retirées comprises : c'est l'historique. */
  entries: PricebookEntry[];
  modifiers: PricingModifier[];
  policy: PayoutPolicy;
}

export async function loadPricingData(sb: Supa): Promise<PricingData> {
  const [workItems, benchmarks, entries, modifiers, policy] = await Promise.all([
    loadWorkItemRows(sb),
    loadWebBenchmarks(sb),
    loadPricebook(sb),
    loadModifiers(sb),
    loadPricingPolicy(sb),
  ]);
  return { workItems, benchmarks, entries, modifiers, policy };
}

/** Ce que lit le moteur : la grille en vigueur, sans le benchmark web. */
export function toPricingGrid(
  data: Pick<PricingData, "workItems" | "entries" | "modifiers" | "policy">,
): PricingGrid {
  return {
    entries: data.entries.filter(isActiveEntry),
    modifiers: data.modifiers,
    policy: data.policy,
    inactiveWorkItems: data.workItems.filter((item) => !item.active).map((item) => item.key),
    vatRateBps: STANDARD_VAT_RATE_BPS,
  };
}
