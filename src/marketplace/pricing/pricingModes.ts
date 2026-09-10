/**
 * Comment un prix s'exprime.
 *
 * Une reliure de création se chiffre sur étude, un décor peut s'annoncer « à
 * partir de » : forcer toutes les opérations dans un prix fixe obligerait à
 * inventer un chiffre là où le métier n'en donne pas.
 */

export const PRICING_MODES = [
  "FIXED",
  "RANGE",
  "PER_UNIT",
  "PER_HOUR",
  "STARTING_FROM",
  "MANUAL_REVIEW",
] as const;

export type PricingMode = (typeof PRICING_MODES)[number];

export const PRICING_MODE_LABELS: Record<PricingMode, string> = {
  FIXED: "Prix fixe",
  RANGE: "Fourchette",
  PER_UNIT: "À l'unité",
  PER_HOUR: "À l'heure",
  STARTING_FROM: "À partir de",
  MANUAL_REVIEW: "Sur étude",
};

/**
 * Les modes proposés dans la grille Ma Reliure. Les autres restent admis par
 * la base pour l'historique, mais un tarif par opération n'a besoin que d'un
 * prix fixe, d'un « à partir de », ou de la revue sur étude.
 */
export const GRID_PRICING_MODES = [
  "FIXED",
  "STARTING_FROM",
  "MANUAL_REVIEW",
] as const satisfies readonly PricingMode[];

/** `MANUAL_REVIEW` refuse d'avoir un montant ; tous les autres en exigent un. */
export function modeCarriesAmount(mode: PricingMode): boolean {
  return mode !== "MANUAL_REVIEW";
}

/** Les modes qui n'ont de sens qu'avec l'unité dans laquelle ils comptent. */
export function modeRequiresUnit(mode: PricingMode): boolean {
  return mode === "PER_UNIT" || mode === "PER_HOUR";
}
