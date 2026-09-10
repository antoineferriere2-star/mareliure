/**
 * La photographie d'un prix validé.
 *
 * Au moment où Ma Reliure annonce un prix à un client, le dossier en garde une
 * copie complète : quelles entrées du Pricebook, dans quelle version, quelles
 * opérations, quelle rémunération, quel HT, quelle TVA, quel TTC, quelle
 * marge, sur quelles preuves — et si la personne qui a validé s'est écartée
 * du Pricebook, pourquoi.
 *
 * Elle ne se recalcule jamais. Qu'on corrige le Pricebook demain ne doit pas
 * changer ce qu'on a promis hier : c'est la différence entre un prix et une
 * estimation.
 *
 * `validatedAt` et `validatedBy` sont posés par la base, dans la même
 * transaction que la validation : l'horloge du navigateur n'a pas voix au
 * chapitre.
 */
import type { ComplexityClass, SizeClass } from "./catalog";
import type { CompositionPolicy, CompositionResult } from "./composition";
import { assessMargin, type MarginStatus } from "./margin";
import type { EvidenceLevel } from "./pricebookEvidence";
import type { PricingMode } from "./pricingModes";
import { fromHt } from "./vat";

export const PRICING_SNAPSHOT_SCHEMA_VERSION = 1;

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
    unitLabel: string | null;
    entryId: string | null;
    entryVersion: number | null;
    unitPayoutCents: number | null;
    unitPriceHtCents: number | null;
    payoutCents: number | null;
    priceHtCents: number | null;
    includedIn: string | null;
    modifiers: string[];
  }[];
  pricebookVersions: {
    entryId: string;
    workItemKey: string;
    sizeClass: SizeClass;
    complexityClass: ComplexityClass;
    version: number;
  }[];
  /** Ce que le Pricebook donnait. `null` s'il ne chiffrait pas le projet. */
  composed: {
    payoutCents: number;
    priceHtCents: number;
    priceHtHighCents: number | null;
    startingFrom: boolean;
  } | null;
  compositionReasons: string[];
  payoutCents: number;
  priceHtCents: number;
  vatRateBps: number;
  vatCents: number;
  priceTtcCents: number;
  margin: {
    status: MarginStatus;
    marginCents: number;
    marginBps: number;
    targetMarginBps: number;
    minimumMarginCents: number;
    reasons: string[];
  };
  confidence: { level: EvidenceLevel; label: string; alerts: string[] };
  overridden: boolean;
  overrideReason: string | null;
  priceIncludes: string[];
}

export interface SnapshotInput {
  composition: CompositionResult;
  retainedPayoutCents: number;
  retainedPriceHtCents: number;
  vatRateBps: number;
  policy: CompositionPolicy;
  confidence: { level: EvidenceLevel; label: string; alerts: string[] };
  overrideReason: string | null;
  priceIncludes: string[];
  ruleVersion: string;
}

/**
 * Construit la photographie, ou dit pourquoi elle ne peut pas l'être.
 *
 * S'écarter du Pricebook est permis — un livre n'est jamais tout à fait celui
 * que la grille imaginait — mais pas sans raison écrite. Et un projet que le
 * Pricebook ne chiffre pas peut recevoir un prix, fixé à la main après étude,
 * à la même condition.
 */
export function buildPricingSnapshot(input: SnapshotInput): {
  snapshot: PricingSnapshot | null;
  errors: string[];
} {
  const errors: string[] = [];
  const payout = input.retainedPayoutCents;
  const price = input.retainedPriceHtCents;
  if (!Number.isInteger(payout) || payout <= 0 || !Number.isInteger(price) || price <= 0)
    errors.push(
      "La rémunération et le prix HT retenus doivent être des montants positifs en centimes.",
    );
  else if (payout > price) errors.push("La rémunération atelier ne peut pas dépasser le prix HT.");

  const { composition } = input;
  const composed =
    composition.status === "priced" &&
    composition.payoutCents !== null &&
    composition.priceHtCents !== null
      ? {
          payoutCents: composition.payoutCents,
          priceHtCents: composition.priceHtCents,
          priceHtHighCents: composition.priceHtHighCents,
          startingFrom: composition.startingFrom,
        }
      : null;

  const overridden =
    composed === null || composed.payoutCents !== payout || composed.priceHtCents !== price;
  const overrideReason = input.overrideReason?.trim() || null;
  if (overridden && !overrideReason)
    errors.push(
      composed === null
        ? "Le Pricebook ne chiffre pas ce projet : un prix fixé à la main dit sur quoi il repose."
        : "Un prix qui s'écarte du Pricebook dit pourquoi.",
    );

  if (errors.length > 0) return { snapshot: null, errors };

  const breakdown = fromHt(price, input.vatRateBps);
  const margin = assessMargin({ priceHtCents: price, payoutCents: payout, ...input.policy });

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
      unitLabel: line.unitLabel,
      entryId: line.entryId,
      entryVersion: line.entryVersion,
      unitPayoutCents: line.unitPayoutCents,
      unitPriceHtCents: line.unitPriceHtCents,
      payoutCents: line.payoutCents,
      priceHtCents: line.priceHtCents,
      includedIn: line.includedIn,
      modifiers: line.modifiers,
    })),
    pricebookVersions: composition.lines
      .filter((line) => line.entryId !== null && line.entryVersion !== null)
      .map((line) => ({
        entryId: line.entryId!,
        workItemKey: line.workItemKey,
        sizeClass: line.entrySizeClass!,
        complexityClass: line.entryComplexityClass!,
        version: line.entryVersion!,
      })),
    composed,
    compositionReasons: composition.reasons,
    payoutCents: payout,
    priceHtCents: price,
    vatRateBps: breakdown.vatRateBps,
    vatCents: breakdown.vatCents,
    priceTtcCents: breakdown.ttcCents,
    margin: {
      status: margin.status,
      marginCents: margin.marginCents,
      marginBps: margin.marginBps,
      targetMarginBps: margin.targetMarginBps,
      minimumMarginCents: margin.minimumMarginCents,
      reasons: margin.reasons,
    },
    confidence: input.confidence,
    overridden,
    overrideReason,
    priceIncludes: input.priceIncludes,
  };

  // Une copie profonde : la photographie ne partage aucune référence avec la
  // composition qui l'a produite.
  return { snapshot: structuredClone(snapshot), errors };
}
