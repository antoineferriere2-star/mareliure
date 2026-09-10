/**
 * Les modificateurs de format et de complexité.
 *
 * Un tarif par opération, au format et à la complexité courants ; les écarts
 * se règlent ici, une fois pour toute la grille, plutôt que par quarante-cinq
 * opérations multipliées par quatre formats et trois complexités.
 *
 * Un modificateur s'applique au **total du projet**, après addition des
 * opérations : « grand format +15 % » majore le projet, pas chaque titrage.
 *
 * Trois formes : un pourcentage, un montant fixe, ou la revue manuelle — le
 * projet sort alors du calcul automatique. Un modificateur n'existe que si
 * Ma Reliure l'a écrit : une classe sans modificateur actif garde le prix du
 * format courant, et la composition le signale.
 */
import type { ComplexityClass, SizeClass } from "./catalog";

export const MODIFIER_AXES = ["size", "complexity"] as const;
export type ModifierAxis = (typeof MODIFIER_AXES)[number];

export const MODIFIER_KINDS = ["PERCENT", "FIXED", "MANUAL_REVIEW"] as const;
export type ModifierKind = (typeof MODIFIER_KINDS)[number];

export const MODIFIER_KIND_LABELS: Record<ModifierKind, string> = {
  PERCENT: "Pourcentage",
  FIXED: "Montant fixe",
  MANUAL_REVIEW: "Revue manuelle",
};

/** La classe courante est la base : elle n'a pas de modificateur. */
export const MODIFIABLE_CLASSES: Record<ModifierAxis, readonly string[]> = {
  size: ["small", "large", "oversize"] satisfies readonly SizeClass[],
  complexity: ["simple", "complex"] satisfies readonly ComplexityClass[],
};

export interface PricingModifier {
  id: string;
  axis: ModifierAxis;
  classKey: string;
  kind: ModifierKind;
  percentBps: number | null;
  fixedCents: number | null;
  enabled: boolean;
  notes: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

/** Un modificateur ne compte que s'il est activé et porte ce qu'il annonce. */
export function activeModifier(
  modifiers: readonly PricingModifier[],
  axis: ModifierAxis,
  classKey: string,
): PricingModifier | null {
  const found = modifiers.find(
    (modifier) => modifier.axis === axis && modifier.classKey === classKey,
  );
  if (!found || !found.enabled) return null;
  if (found.kind === "PERCENT" && found.percentBps === null) return null;
  if (found.kind === "FIXED" && found.fixedCents === null) return null;
  return found;
}

export function applyModifier(amountCents: number, modifier: PricingModifier): number {
  if (modifier.kind === "PERCENT")
    return amountCents + Math.round((amountCents * (modifier.percentBps ?? 0)) / 10_000);
  if (modifier.kind === "FIXED") return amountCents + (modifier.fixedCents ?? 0);
  return amountCents;
}

export function describeModifier(modifier: PricingModifier): string {
  if (modifier.kind === "MANUAL_REVIEW") return "revue manuelle";
  if (modifier.kind === "PERCENT") {
    const bps = modifier.percentBps ?? 0;
    return `${bps >= 0 ? "+" : ""}${(bps / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;
  }
  const cents = modifier.fixedCents ?? 0;
  return `${cents >= 0 ? "+" : "−"}${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Math.abs(cents) / 100)}`;
}

export function validateModifier(input: {
  axis: ModifierAxis;
  classKey: string;
  kind: ModifierKind;
  percentBps: number | null;
  fixedCents: number | null;
  enabled: boolean;
}): string[] {
  const errors: string[] = [];
  if (!MODIFIABLE_CLASSES[input.axis].includes(input.classKey))
    errors.push("Cette classe n'a pas de modificateur : la classe courante est la base.");
  if (input.kind === "PERCENT") {
    if (input.fixedCents !== null) errors.push("Un pourcentage ne porte pas de montant fixe.");
    if (
      input.percentBps !== null &&
      (!Number.isInteger(input.percentBps) ||
        input.percentBps < -9_000 ||
        input.percentBps > 50_000)
    )
      errors.push("Le pourcentage doit être compris entre −90 % et +500 %.");
  } else if (input.kind === "FIXED") {
    if (input.percentBps !== null) errors.push("Un montant fixe ne porte pas de pourcentage.");
    if (input.fixedCents !== null && !Number.isInteger(input.fixedCents))
      errors.push("Le montant fixe doit être un entier de centimes.");
  } else if (input.percentBps !== null || input.fixedCents !== null) {
    errors.push("La revue manuelle ne porte aucune valeur.");
  }
  if (
    input.enabled &&
    input.kind !== "MANUAL_REVIEW" &&
    input.percentBps === null &&
    input.fixedCents === null
  )
    errors.push("Un modificateur activé doit porter une valeur.");
  return errors;
}
