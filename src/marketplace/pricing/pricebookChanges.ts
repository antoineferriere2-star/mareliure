/**
 * Ce qu'un geste sur la grille écrit au Pricebook.
 *
 * Quatre gestes, une seule forme d'écriture — une nouvelle version :
 *
 * - `set` : Ma Reliure fixe un tarif ou un mode. C'est une décision, donc un
 *   prix validé (`ADMIN_VALIDATED`) ;
 * - `validate` : Ma Reliure garde la référence initiale telle quelle ;
 * - `reset` : retour à la référence web, qui redevient une référence
 *   initiale à valider ;
 * - `visibility` : afficher ou retirer un prix validé de `/tarifs`.
 *
 * Les montants sont calculés ici, une fois : le HT sort de `vat.ts`. La base
 * vérifie la cohérence et la concurrence, elle ne recalcule rien.
 */
import { workItem } from "./catalog";
import type { PricebookEntry } from "./pricebook";
import type { PricingMode } from "./pricingModes";
import type { GridProvenance } from "./provenance";
import { fromTtc, STANDARD_VAT_RATE_BPS } from "./vat";
import type { WebBenchmark } from "./webBenchmark";

export const GRID_ACTIONS = ["set", "validate", "reset", "visibility"] as const;
export type GridAction = (typeof GRID_ACTIONS)[number];

/** Au-delà, une saisie est une faute de frappe, pas un prix de reliure. */
export const MAX_GRID_PRICE_CENTS = 10_000_000;

export interface GridChangeRequest {
  workItemKey: string;
  action: GridAction;
  priceTtcCents?: number | null;
  pricingMode?: PricingMode;
  publicVisible?: boolean;
}

/** La forme exacte qu'attend `marketplace_save_pricebook_changes`. */
export interface PricebookChange {
  work_item_key: string;
  action: GridAction;
  expected_entry_id: string | null;
  status: "draft" | "published";
  provenance: GridProvenance;
  pricing_mode: PricingMode;
  customer_price_cents: number | null;
  customer_price_ttc_cents: number | null;
  vat_rate_bps: number;
  public_visible: boolean;
}

export interface PlannedChange {
  change: PricebookChange | null;
  errors: string[];
}

function amounts(priceTtcCents: number | null, vatRateBps: number) {
  if (priceTtcCents === null) return { ht: null, ttc: null };
  return { ht: fromTtc(priceTtcCents, vatRateBps).htCents, ttc: priceTtcCents };
}

export function planPricebookChange(
  request: GridChangeRequest,
  current: { entry: PricebookEntry | null; benchmark: WebBenchmark | null },
  vatRateBps: number = STANDARD_VAT_RATE_BPS,
): PlannedChange {
  const item = workItem(request.workItemKey);
  if (!item) return { change: null, errors: ["Prestation hors catalogue."] };
  const { entry, benchmark } = current;
  const study = item.requiresStudy === true;
  const base = {
    work_item_key: item.key,
    action: request.action,
    expected_entry_id: entry?.id ?? null,
    vat_rate_bps: vatRateBps,
  };
  const refuse = (message: string): PlannedChange => ({ change: null, errors: [message] });

  switch (request.action) {
    case "set": {
      const mode = request.pricingMode ?? entry?.pricingMode ?? (study ? "MANUAL_REVIEW" : "FIXED");
      if (study && mode !== "MANUAL_REVIEW")
        return refuse(`${item.label} se chiffre sur étude : pas de prix automatique.`);
      const price =
        mode === "MANUAL_REVIEW" ? null : (request.priceTtcCents ?? entry?.priceTtcCents ?? null);
      if (mode !== "MANUAL_REVIEW") {
        if (price === null || !Number.isInteger(price) || price <= 0)
          return refuse(`${item.label} : le tarif doit être un montant positif.`);
        if (price > MAX_GRID_PRICE_CENTS)
          return refuse(`${item.label} : ce montant ressemble à une faute de frappe.`);
      }
      if (
        entry?.status === "published" &&
        entry.pricingMode === mode &&
        entry.priceTtcCents === price
      )
        return refuse(`${item.label} : aucun changement.`);
      const { ht, ttc } = amounts(price, vatRateBps);
      if (ht !== null && ht <= 0) return refuse(`${item.label} : le tarif est trop faible.`);
      return {
        errors: [],
        change: {
          ...base,
          status: "published",
          provenance: "ADMIN_VALIDATED",
          pricing_mode: mode,
          customer_price_cents: ht,
          customer_price_ttc_cents: ttc,
          public_visible: mode !== "MANUAL_REVIEW" && (entry?.publicVisible ?? false),
        },
      };
    }

    case "validate": {
      if (!entry) return refuse(`${item.label} : aucun tarif à valider.`);
      if (entry.status !== "draft") return refuse(`${item.label} : déjà validé.`);
      const { ht, ttc } = amounts(entry.priceTtcCents, vatRateBps);
      return {
        errors: [],
        change: {
          ...base,
          status: "published",
          provenance: "ADMIN_VALIDATED",
          pricing_mode: entry.pricingMode,
          customer_price_cents: ht,
          customer_price_ttc_cents: ttc,
          public_visible: false,
        },
      };
    }

    case "reset": {
      const mode: PricingMode = study ? "MANUAL_REVIEW" : "FIXED";
      const reference = study ? null : (benchmark?.webReferenceCents ?? null);
      if (!study && (reference === null || benchmark?.pricingUnit !== "per_book"))
        return refuse(`${item.label} : pas de référence web à laquelle revenir.`);
      if (
        entry?.status === "draft" &&
        entry.pricingMode === mode &&
        entry.priceTtcCents === reference
      )
        return refuse(`${item.label} : déjà à la référence web.`);
      const { ht, ttc } = amounts(reference, vatRateBps);
      return {
        errors: [],
        change: {
          ...base,
          status: "draft",
          provenance: "WEB_REFERENCE_INITIAL",
          pricing_mode: mode,
          customer_price_cents: ht,
          customer_price_ttc_cents: ttc,
          public_visible: false,
        },
      };
    }

    case "visibility": {
      const visible = request.publicVisible === true;
      if (!entry || entry.status !== "published")
        return refuse(`${item.label} : seul un tarif validé peut être affiché sur /tarifs.`);
      if (visible && (entry.pricingMode === "MANUAL_REVIEW" || entry.priceTtcCents === null))
        return refuse(`${item.label} : un travail sur étude n'a pas de prix à afficher.`);
      if (entry.publicVisible === visible) return refuse(`${item.label} : aucun changement.`);
      const { ht, ttc } = amounts(entry.priceTtcCents, vatRateBps);
      return {
        errors: [],
        change: {
          ...base,
          status: "published",
          provenance: "ADMIN_VALIDATED",
          pricing_mode: entry.pricingMode,
          customer_price_cents: ht,
          customer_price_ttc_cents: ttc,
          public_visible: visible,
        },
      };
    }
  }
}
