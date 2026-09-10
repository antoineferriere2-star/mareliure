/**
 * La photographie d'un prix validé.
 *
 * Au moment où Ma Reliure annonce un prix à un client, le dossier en garde une
 * copie complète : quelles versions de la grille, quelles opérations, quels
 * modificateurs, quel TTC, quel HT, quelle TVA, quelle rémunération, quelle
 * marge, sous quelle politique — et, si la personne qui valide s'est écartée
 * de la grille, pourquoi.
 *
 * Elle ne se recalcule jamais. Qu'on change un tarif demain ne change pas ce
 * qu'on a promis hier.
 *
 * S'écarter de la grille est permis — un livre n'est jamais tout à fait celui
 * qu'elle imaginait — mais pas sans raison écrite, et le prix devient alors
 * `CASE_OVERRIDE` : il appartient au dossier, la grille ne bouge pas. Même
 * règle quand une opération repose sur une référence web que personne n'a
 * encore validée.
 *
 * `validatedAt` et `validatedBy` sont posés par la base, dans la même
 * transaction que la validation.
 */
import type { ComplexityClass, SizeClass } from "./catalog";
import type { AppliedModifier, CompositionResult } from "./composition";
import { assessMargin, type MarginStatus } from "./margin";
import type { PayoutPolicy } from "./payout";
import type { PricingMode } from "./pricingModes";
import type { GridProvenance } from "./provenance";
import { fromTtc } from "./vat";

export const PRICING_SNAPSHOT_SCHEMA_VERSION = 2;

export interface PricingSnapshot {
  schemaVersion: typeof PRICING_SNAPSHOT_SCHEMA_VERSION;
  ruleVersion: string;
  sizeClass: SizeClass;
  complexityClass: ComplexityClass;
  operations: {
    workItemKey: string;
    label: string;
    quantity: number;
    mode: PricingMode | null;
    entryId: string | null;
    entryVersion: number | null;
    provenance: GridProvenance | null;
    unitPriceTtcCents: number | null;
    priceTtcCents: number | null;
  }[];
  pricebookVersions: {
    entryId: string;
    workItemKey: string;
    version: number;
    provenance: GridProvenance;
  }[];
  modifiers: AppliedModifier[];
  /** Ce que la grille donnait. `null` si elle ne chiffrait pas le projet. */
  composed: {
    subtotalTtcCents: number;
    priceTtcCents: number;
    payoutCents: number | null;
  } | null;
  compositionReasons: string[];
  compositionWarnings: string[];
  priceTtcCents: number;
  priceHtCents: number;
  vatRateBps: number;
  vatCents: number;
  payoutCents: number;
  policy: PayoutPolicy;
  margin: {
    status: MarginStatus;
    marginCents: number;
    marginBps: number;
    targetMarginBps: number;
    minimumMarginCents: number;
    reasons: string[];
  };
  provenance: "ADMIN_VALIDATED" | "CASE_OVERRIDE";
  overridden: boolean;
  overrideReason: string | null;
  priceIncludes: string[];
}

export interface SnapshotInput {
  composition: CompositionResult;
  retainedPriceTtcCents: number;
  retainedPayoutCents: number;
  vatRateBps: number;
  overrideReason: string | null;
  priceIncludes: string[];
  ruleVersion: string;
}

export function buildPricingSnapshot(input: SnapshotInput): {
  snapshot: PricingSnapshot | null;
  errors: string[];
} {
  const errors: string[] = [];
  const price = input.retainedPriceTtcCents;
  const payout = input.retainedPayoutCents;
  if (!Number.isInteger(payout) || payout <= 0 || !Number.isInteger(price) || price <= 0)
    return {
      snapshot: null,
      errors: ["Le prix client et la rémunération retenus doivent être des montants positifs."],
    };

  const breakdown = fromTtc(price, input.vatRateBps);
  if (payout > breakdown.htCents)
    errors.push("La rémunération atelier ne peut pas dépasser le prix HT.");

  const { composition } = input;
  const composed =
    composition.status === "priced" &&
    composition.priceTtcCents !== null &&
    composition.subtotalTtcCents !== null
      ? {
          subtotalTtcCents: composition.subtotalTtcCents,
          priceTtcCents: composition.priceTtcCents,
          payoutCents: composition.payout?.payoutCents ?? null,
        }
      : null;

  const overridden =
    composed === null || composed.priceTtcCents !== price || composed.payoutCents !== payout;
  const unvalidated = composed === null ? [] : composition.unvalidated;
  const overrideReason = input.overrideReason?.trim() || null;
  if ((overridden || unvalidated.length > 0) && !overrideReason)
    errors.push(
      composed === null
        ? "La grille ne chiffre pas ce projet : un prix fixé à la main dit sur quoi il repose."
        : overridden
          ? "Un prix qui s'écarte de la grille dit pourquoi."
          : `Tarif non validé dans la grille (${unvalidated.join(", ")}) : validez-le dans la grille, ou justifiez ce prix sur le dossier.`,
    );

  if (errors.length > 0) return { snapshot: null, errors };

  const margin = assessMargin({
    priceHtCents: breakdown.htCents,
    payoutCents: payout,
    targetMarginBps: composition.policy.targetMarginBps,
    minimumMarginCents: composition.policy.minimumMarginCents,
  });

  const snapshot: PricingSnapshot = {
    schemaVersion: PRICING_SNAPSHOT_SCHEMA_VERSION,
    ruleVersion: input.ruleVersion,
    sizeClass: composition.sizeClass,
    complexityClass: composition.complexityClass,
    operations: composition.lines.map((line) => ({
      workItemKey: line.workItemKey,
      label: line.label,
      quantity: line.quantity,
      mode: line.mode,
      entryId: line.entryId,
      entryVersion: line.entryVersion,
      provenance: line.provenance,
      unitPriceTtcCents: line.unitPriceTtcCents,
      priceTtcCents: line.priceTtcCents,
    })),
    pricebookVersions: composition.lines
      .filter((line) => line.entryId !== null && line.entryVersion !== null && line.provenance)
      .map((line) => ({
        entryId: line.entryId!,
        workItemKey: line.workItemKey,
        version: line.entryVersion!,
        provenance: line.provenance!,
      })),
    modifiers: composition.modifiers,
    composed,
    compositionReasons: composition.reasons,
    compositionWarnings: composition.warnings,
    priceTtcCents: breakdown.ttcCents,
    priceHtCents: breakdown.htCents,
    vatRateBps: breakdown.vatRateBps,
    vatCents: breakdown.vatCents,
    payoutCents: payout,
    policy: { ...composition.policy },
    margin: {
      status: margin.status,
      marginCents: margin.marginCents,
      marginBps: margin.marginBps,
      targetMarginBps: margin.targetMarginBps,
      minimumMarginCents: margin.minimumMarginCents,
      reasons: margin.reasons,
    },
    provenance: overridden || unvalidated.length > 0 ? "CASE_OVERRIDE" : "ADMIN_VALIDATED",
    overridden,
    overrideReason,
    priceIncludes: input.priceIncludes,
  };

  // Une copie profonde : la photographie ne partage aucune référence avec la
  // composition qui l'a produite, ni avec la grille.
  return { snapshot: structuredClone(snapshot), errors };
}
