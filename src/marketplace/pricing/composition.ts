/**
 * Composer le prix d'un projet à partir de la grille Ma Reliure.
 *
 * Un projet est une liste d'opérations. Son prix est la somme de leurs tarifs
 * dans le Pricebook, puis les modificateurs de format et de complexité, et
 * rien d'autre : ni benchmark web, ni tarif d'atelier, ni coefficient caché.
 * La rémunération proposée à l'atelier se déduit ensuite du prix HT, par la
 * politique de marge.
 *
 * Exemple : demi-cuir 390 € + titrage 50 € = 440 € TTC.
 *
 * Les règles qui tiennent le calcul honnête :
 *
 * 1. **Un trou suffit à ne pas conclure.** Une opération sans tarif, sur étude
 *    ou désactivée, et le total est `null` : un total partiel aurait l'air
 *    complet.
 * 2. **Les rôles du catalogue sont respectés.** Un ouvrage porte au plus une
 *    structure (on ne relie pas en plein cuir *et* en demi-toile). La
 *    protection fait exception : un étui ou une chemise accompagne une reliure.
 * 3. **Une référence initiale se voit.** Le simulateur l'utilise ; la liste
 *    `unvalidated` dit quelles opérations n'ont pas encore été validées, pour
 *    qu'aucun dossier ne les promette sans décision.
 */
import {
  COMPLEXITY_CLASS_LABELS,
  SIZE_CLASS_LABELS,
  workItem,
  workItemLabel,
  type ComplexityClass,
  type SizeClass,
  type WorkFamilyKey,
  type WorkRole,
} from "./catalog";
import { assessMargin, type MarginAssessment } from "./margin";
import {
  activeModifier,
  applyModifier,
  describeModifier,
  type ModifierAxis,
  type ModifierKind,
  type PricingModifier,
} from "./modifiers";
import { proposeBinderPayout, type PayoutPolicy, type PayoutProposal } from "./payout";
import { activeEntry, type PricebookEntry } from "./pricebook";
import type { PricingMode } from "./pricingModes";
import type { GridProvenance } from "./provenance";
import { fromTtc, STANDARD_VAT_RATE_BPS, type PriceBreakdown } from "./vat";

export interface CompositionLine {
  workItemKey: string;
  quantity: number;
}

export interface ComposedLine {
  workItemKey: string;
  label: string;
  family: WorkFamilyKey | null;
  role: WorkRole | null;
  quantity: number;
  entryId: string | null;
  entryVersion: number | null;
  provenance: GridProvenance | null;
  mode: PricingMode | null;
  unitPriceTtcCents: number | null;
  priceTtcCents: number | null;
  /** Pourquoi l'opération n'a pas de prix. */
  problem: string | null;
}

export interface AppliedModifier {
  axis: ModifierAxis;
  classKey: string;
  kind: ModifierKind;
  /** « Grand format +15 % ». */
  label: string;
  deltaTtcCents: number;
}

/** Tout ce que le moteur lit pour chiffrer : la grille et ses règles. */
export interface PricingGrid {
  entries: readonly PricebookEntry[];
  modifiers: readonly PricingModifier[];
  policy: PayoutPolicy;
  /** Les opérations désactivées dans la grille. */
  inactiveWorkItems?: readonly string[];
  vatRateBps?: number;
}

export interface CompositionRequest {
  lines: readonly CompositionLine[];
  sizeClass: SizeClass;
  complexityClass: ComplexityClass;
}

export interface CompositionResult {
  status: "priced" | "manual_review";
  /** Ce qui empêche de conclure. Vide si le projet est chiffré. */
  reasons: string[];
  /** Ce qui mérite un regard sans empêcher de conclure. */
  warnings: string[];
  lines: ComposedLine[];
  sizeClass: SizeClass;
  complexityClass: ComplexityClass;
  /** La somme des opérations, avant modificateurs. */
  subtotalTtcCents: number | null;
  modifiers: AppliedModifier[];
  priceTtcCents: number | null;
  breakdown: PriceBreakdown | null;
  startingFrom: boolean;
  /** Les opérations chiffrées sur une référence initiale non validée. */
  unvalidated: string[];
  payout: PayoutProposal | null;
  margin: MarginAssessment | null;
  policy: PayoutPolicy;
}

export const MAX_LINE_QUANTITY = 999;

function classLabel(axis: ModifierAxis, classKey: string): string {
  return axis === "size"
    ? SIZE_CLASS_LABELS[classKey as SizeClass]
    : `Complexité ${COMPLEXITY_CLASS_LABELS[classKey as ComplexityClass].toLowerCase()}`;
}

export function composePrice(request: CompositionRequest, grid: PricingGrid): CompositionResult {
  const { sizeClass, complexityClass } = request;
  const inactive = new Set(grid.inactiveWorkItems ?? []);
  const reasons: string[] = [];
  const warnings: string[] = [];

  const unique = new Map<string, CompositionLine>();
  for (const line of request.lines)
    if (!unique.has(line.workItemKey)) unique.set(line.workItemKey, line);

  const lines: ComposedLine[] = [...unique.values()].map((line) => {
    const item = workItem(line.workItemKey);
    const composed: ComposedLine = {
      workItemKey: line.workItemKey,
      label: workItemLabel(line.workItemKey),
      family: item?.family ?? null,
      role: item?.role ?? null,
      quantity: line.quantity,
      entryId: null,
      entryVersion: null,
      provenance: null,
      mode: null,
      unitPriceTtcCents: null,
      priceTtcCents: null,
      problem: null,
    };
    if (!item) return { ...composed, problem: "prestation hors catalogue." };
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_LINE_QUANTITY)
      return { ...composed, problem: "quantité invalide." };
    if (inactive.has(item.key)) return { ...composed, problem: "prestation désactivée dans la grille." };

    const entry = activeEntry(grid.entries, item.key);
    if (!entry) return { ...composed, problem: "aucun tarif dans la grille." };
    const withEntry = {
      ...composed,
      entryId: entry.id,
      entryVersion: entry.version,
      provenance: entry.provenance,
      mode: entry.pricingMode,
    };
    if (item.requiresStudy || entry.pricingMode === "MANUAL_REVIEW")
      return { ...withEntry, problem: "sur étude." };
    if (entry.priceTtcCents === null || entry.priceTtcCents <= 0)
      return { ...withEntry, problem: "aucun tarif dans la grille." };
    return {
      ...withEntry,
      unitPriceTtcCents: entry.priceTtcCents,
      priceTtcCents: entry.priceTtcCents * line.quantity,
    };
  });

  const policy = grid.policy;
  const abstain = (subtotal: number | null, modifiers: AppliedModifier[] = []): CompositionResult => ({
    status: "manual_review",
    reasons,
    warnings,
    lines,
    sizeClass,
    complexityClass,
    subtotalTtcCents: subtotal,
    modifiers,
    priceTtcCents: null,
    breakdown: null,
    startingFrom: false,
    unvalidated: [],
    payout: null,
    margin: null,
    policy,
  });

  if (lines.length === 0) {
    reasons.push("Aucune prestation sélectionnée.");
    return abstain(null);
  }

  const structures = lines.filter(
    (line) => line.role === "structure" && line.family !== "protection",
  );
  if (structures.length > 1)
    reasons.push(
      `Deux structures sélectionnées (${structures.map((line) => line.label).join(", ")}) : un ouvrage n'en porte qu'une.`,
    );
  for (const line of lines) if (line.problem) reasons.push(`${line.label} : ${line.problem}`);
  if (reasons.length > 0) return abstain(null);

  const subtotal = lines.reduce((sum, line) => sum + (line.priceTtcCents ?? 0), 0);

  let total = subtotal;
  const applied: AppliedModifier[] = [];
  const axes: [ModifierAxis, string][] = [
    ["size", sizeClass],
    ["complexity", complexityClass],
  ];
  for (const [axis, classKey] of axes) {
    if (classKey === "standard") continue;
    const modifier = activeModifier(grid.modifiers, axis, classKey);
    if (!modifier) {
      warnings.push(
        `${classLabel(axis, classKey)} : aucun modificateur configuré, prix du format et de la complexité courants.`,
      );
      continue;
    }
    if (modifier.kind === "MANUAL_REVIEW") {
      reasons.push(`${classLabel(axis, classKey)} : revue manuelle.`);
      continue;
    }
    const next = applyModifier(total, modifier);
    applied.push({
      axis,
      classKey,
      kind: modifier.kind,
      label: `${classLabel(axis, classKey)} ${describeModifier(modifier)}`,
      deltaTtcCents: next - total,
    });
    total = next;
  }
  if (reasons.length > 0) return abstain(subtotal, applied);
  if (total <= 0) {
    reasons.push("Les modificateurs produisent un montant incohérent.");
    return abstain(subtotal, applied);
  }

  const breakdown = fromTtc(total, grid.vatRateBps ?? STANDARD_VAT_RATE_BPS);
  const payout = proposeBinderPayout(breakdown.htCents, policy);
  if (payout.problem) warnings.push(payout.problem);
  const unvalidated = lines
    .filter((line) => line.provenance === "WEB_REFERENCE_INITIAL")
    .map((line) => line.label);
  if (unvalidated.length > 0)
    warnings.push(`Référence initiale web non validée : ${unvalidated.join(", ")}.`);

  return {
    status: "priced",
    reasons,
    warnings,
    lines,
    sizeClass,
    complexityClass,
    subtotalTtcCents: subtotal,
    modifiers: applied,
    priceTtcCents: total,
    breakdown,
    startingFrom: lines.some((line) => line.mode === "STARTING_FROM"),
    unvalidated,
    payout,
    margin:
      payout.payoutCents === null
        ? null
        : assessMargin({
            priceHtCents: breakdown.htCents,
            payoutCents: payout.payoutCents,
            targetMarginBps: policy.targetMarginBps,
            minimumMarginCents: policy.minimumMarginCents,
          }),
    policy,
  };
}
