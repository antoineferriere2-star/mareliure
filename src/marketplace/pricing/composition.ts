/**
 * Composer un prix à partir du Pricebook.
 *
 * Un projet est une structure et des compléments — un demi-cuir, un titrage,
 * une réparation de coins. Chacun a (ou n'a pas) son entrée au Pricebook ; le
 * prix du projet est leur somme, et rien d'autre. Ce module ne lit ni les
 * grilles d'ateliers ni le benchmark : ce sont des références qu'on affiche à
 * côté, pas des sources de prix.
 *
 * Trois règles qui tiennent l'ensemble honnête :
 *
 * 1. **Un trou suffit à ne pas conclure.** Un seul travail sans prix publié,
 *    un seul travail sur étude, et le total est `null`. Un total partiel
 *    aurait l'air complet, et il se validerait.
 * 2. **Rien ne se facture deux fois.** Une entrée qui déclare inclure un
 *    travail (`includedWorkItems`) le couvre : s'il est aussi sélectionné, il
 *    reste visible, à zéro, avec ce qui l'inclut.
 * 3. **Pas de coefficient implicite.** Faute d'entrée exacte pour le format
 *    ou la complexité, on ne se rabat sur la classe courante qu'à travers un
 *    modificateur activé par un humain. Sans lui, le travail est non chiffré.
 */
import {
  COMPLEXITY_CLASS_LABELS,
  SIZE_CLASS_LABELS,
  requiresStudy,
  workItem,
  workItemLabel,
  type ComplexityClass,
  type SizeClass,
  type WorkRole,
} from "./catalog";
import { assessMargin, type MarginAssessment } from "./margin";
import { activeModifier, applyModifier, describeModifier, type PricingModifier } from "./modifiers";
import type { PricebookEntry } from "./pricebook";
import type { PricingMode } from "./pricingModes";
import { fromHt, STANDARD_VAT_RATE_BPS, type PriceBreakdown } from "./vat";

export interface CompositionLine {
  workItemKey: string;
  quantity: number;
}

export interface ComposedLine {
  workItemKey: string;
  label: string;
  role: WorkRole | null;
  quantity: number;
  entryId: string | null;
  entryVersion: number | null;
  entrySizeClass: SizeClass | null;
  entryComplexityClass: ComplexityClass | null;
  mode: PricingMode | null;
  unitLabel: string | null;
  unitPayoutCents: number | null;
  unitPriceHtCents: number | null;
  unitPriceHtHighCents: number | null;
  payoutCents: number | null;
  priceHtCents: number | null;
  priceHtHighCents: number | null;
  /** Le travail sélectionné dont le prix couvre déjà celui-ci. */
  includedIn: string | null;
  /** Les modificateurs appliqués, lisibles : « Grand format +15 % ». */
  modifiers: string[];
  /** Pourquoi la ligne n'a pas de prix. */
  problem: string | null;
}

export interface CompositionPolicy {
  targetMarginBps: number;
  minimumMarginCents: number;
}

export interface CompositionInput {
  lines: readonly CompositionLine[];
  sizeClass: SizeClass;
  complexityClass: ComplexityClass;
  entries: readonly PricebookEntry[];
  modifiers: readonly PricingModifier[];
  policy: CompositionPolicy;
  vatRateBps?: number;
}

export interface CompositionResult {
  status: "priced" | "manual_review";
  reasons: string[];
  lines: ComposedLine[];
  sizeClass: SizeClass;
  complexityClass: ComplexityClass;
  payoutCents: number | null;
  priceHtCents: number | null;
  /** Le haut, quand au moins une ligne est une fourchette. */
  priceHtHighCents: number | null;
  /** Au moins une ligne est « à partir de » : le total est un minimum. */
  startingFrom: boolean;
  breakdown: PriceBreakdown | null;
  margin: MarginAssessment | null;
}

export const MAX_LINE_QUANTITY = 999;

interface Resolution {
  entry: PricebookEntry;
  modifiers: PricingModifier[];
}

/**
 * L'entrée à utiliser, de la plus précise à la plus générale — mais une
 * classe voisine n'est acceptée que si un modificateur activé fait le pont.
 */
function resolveEntry(
  published: readonly PricebookEntry[],
  modifiers: readonly PricingModifier[],
  workItemKey: string,
  sizeClass: SizeClass,
  complexityClass: ComplexityClass,
): Resolution | null {
  const candidates: [SizeClass, ComplexityClass][] = [
    [sizeClass, complexityClass],
    [sizeClass, "standard"],
    ["standard", complexityClass],
    ["standard", "standard"],
  ];
  const tried = new Set<string>();
  for (const [size, complexity] of candidates) {
    const id = `${size}|${complexity}`;
    if (tried.has(id)) continue;
    tried.add(id);

    const entry = published.find(
      (candidate) =>
        candidate.workItemKey === workItemKey &&
        candidate.sizeClass === size &&
        candidate.complexityClass === complexity,
    );
    if (!entry) continue;

    const bridges: PricingModifier[] = [];
    if (size !== sizeClass) {
      const bridge = activeModifier(modifiers, "size", sizeClass);
      if (!bridge) continue;
      bridges.push(bridge);
    }
    if (complexity !== complexityClass) {
      const bridge = activeModifier(modifiers, "complexity", complexityClass);
      if (!bridge) continue;
      bridges.push(bridge);
    }
    return { entry, modifiers: bridges };
  }
  return null;
}

function modifierLabel(modifier: PricingModifier): string {
  const classLabel =
    modifier.axis === "size"
      ? SIZE_CLASS_LABELS[modifier.classKey as SizeClass]
      : `Complexité ${COMPLEXITY_CLASS_LABELS[modifier.classKey as ComplexityClass].toLowerCase()}`;
  return `${classLabel} ${describeModifier(modifier)}`;
}

function emptyLine(line: CompositionLine): ComposedLine {
  return {
    workItemKey: line.workItemKey,
    label: workItemLabel(line.workItemKey),
    role: workItem(line.workItemKey)?.role ?? null,
    quantity: line.quantity,
    entryId: null,
    entryVersion: null,
    entrySizeClass: null,
    entryComplexityClass: null,
    mode: null,
    unitLabel: null,
    unitPayoutCents: null,
    unitPriceHtCents: null,
    unitPriceHtHighCents: null,
    payoutCents: null,
    priceHtCents: null,
    priceHtHighCents: null,
    includedIn: null,
    modifiers: [],
    problem: null,
  };
}

export function composePrice(input: CompositionInput): CompositionResult {
  const { sizeClass, complexityClass } = input;
  const published = input.entries.filter((entry) => entry.status === "published");
  const reasons: string[] = [];

  const unique = new Map<string, CompositionLine>();
  for (const line of input.lines)
    if (!unique.has(line.workItemKey)) unique.set(line.workItemKey, line);
  const lines = [...unique.values()].map(emptyLine);

  const abstain = (): CompositionResult => ({
    status: "manual_review",
    reasons,
    lines,
    sizeClass,
    complexityClass,
    payoutCents: null,
    priceHtCents: null,
    priceHtHighCents: null,
    startingFrom: false,
    breakdown: null,
    margin: null,
  });

  if (lines.length === 0) {
    reasons.push("Aucun travail sélectionné.");
    return abstain();
  }

  for (const line of lines) {
    if (!workItem(line.workItemKey)) line.problem = "travail hors catalogue.";
    else if (
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > MAX_LINE_QUANTITY
    )
      line.problem = "quantité invalide.";
  }

  const structures = lines.filter((line) => line.role === "structure");
  if (structures.length > 1)
    reasons.push(
      `Deux structures sélectionnées (${structures.map((line) => line.label).join(", ")}) : un ouvrage n'en porte qu'une.`,
    );
  if (requiresStudy(lines.map((line) => line.workItemKey)))
    reasons.push("Le projet comporte un travail qui se chiffre sur étude.");

  const resolved = new Map<string, Resolution>();
  for (const line of lines) {
    if (line.problem) continue;
    const resolution = resolveEntry(
      published,
      input.modifiers,
      line.workItemKey,
      sizeClass,
      complexityClass,
    );
    if (resolution) resolved.set(line.workItemKey, resolution);
  }

  // Les inclusions, structure d'abord : c'est elle qui, le plus souvent,
  // couvre des compléments (« demi-cuir, titrage compris »).
  const selected = new Map(lines.map((line) => [line.workItemKey, line]));
  const ordered = [...lines].sort(
    (a, b) => (a.role === "structure" ? 0 : 1) - (b.role === "structure" ? 0 : 1),
  );
  for (const line of ordered) {
    if (line.includedIn) continue;
    const resolution = resolved.get(line.workItemKey);
    if (!resolution) continue;
    for (const key of resolution.entry.includedWorkItems) {
      const covered = selected.get(key);
      if (!covered || covered === line || covered.includedIn) continue;
      covered.includedIn = line.workItemKey;
    }
  }

  for (const line of lines) {
    if (line.problem) continue;
    if (line.includedIn) {
      line.payoutCents = 0;
      line.priceHtCents = 0;
      continue;
    }

    const resolution = resolved.get(line.workItemKey);
    if (!resolution) {
      line.problem = `aucun prix publié en ${SIZE_CLASS_LABELS[sizeClass].toLowerCase()}, complexité ${COMPLEXITY_CLASS_LABELS[complexityClass].toLowerCase()}, ni modificateur actif pour s'y ramener.`;
      continue;
    }

    const { entry, modifiers } = resolution;
    line.entryId = entry.id;
    line.entryVersion = entry.version;
    line.entrySizeClass = entry.sizeClass;
    line.entryComplexityClass = entry.complexityClass;
    line.mode = entry.pricingMode;
    line.unitLabel = entry.unitLabel;
    line.modifiers = modifiers.map(modifierLabel);

    if (
      entry.pricingMode === "MANUAL_REVIEW" ||
      entry.customerPriceCents === null ||
      entry.referenceBinderPayoutCents === null
    ) {
      line.problem = "le Pricebook le chiffre sur étude.";
      continue;
    }

    const adjust = (amount: number) =>
      modifiers.reduce((current, modifier) => applyModifier(current, modifier), amount);
    const unitPayout = adjust(entry.referenceBinderPayoutCents);
    const unitPrice = adjust(entry.customerPriceCents);
    const unitHigh = entry.priceHtHighCents === null ? null : adjust(entry.priceHtHighCents);

    if (
      unitPayout <= 0 ||
      unitPrice <= 0 ||
      unitPayout > unitPrice ||
      (unitHigh !== null && unitHigh < unitPrice)
    ) {
      line.problem = "les modificateurs produisent un montant incohérent.";
      continue;
    }

    line.unitPayoutCents = unitPayout;
    line.unitPriceHtCents = unitPrice;
    line.unitPriceHtHighCents = unitHigh;
    line.payoutCents = unitPayout * line.quantity;
    line.priceHtCents = unitPrice * line.quantity;
    line.priceHtHighCents = unitHigh === null ? null : unitHigh * line.quantity;
  }

  for (const line of lines) if (line.problem) reasons.push(`${line.label} : ${line.problem}`);
  if (reasons.length > 0) return abstain();

  const payoutCents = lines.reduce((sum, line) => sum + (line.payoutCents ?? 0), 0);
  const priceHtCents = lines.reduce((sum, line) => sum + (line.priceHtCents ?? 0), 0);
  const hasRange = lines.some((line) => line.priceHtHighCents !== null);

  return {
    status: "priced",
    reasons,
    lines,
    sizeClass,
    complexityClass,
    payoutCents,
    priceHtCents,
    priceHtHighCents: hasRange
      ? lines.reduce((sum, line) => sum + (line.priceHtHighCents ?? line.priceHtCents ?? 0), 0)
      : null,
    startingFrom: lines.some((line) => line.mode === "STARTING_FROM"),
    breakdown: fromHt(priceHtCents, input.vatRateBps ?? STANDARD_VAT_RATE_BPS),
    margin: assessMargin({ priceHtCents, payoutCents, ...input.policy }),
  };
}
