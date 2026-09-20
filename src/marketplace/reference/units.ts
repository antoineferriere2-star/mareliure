/**
 * Le vocabulaire d'unités CONTRÔLÉ du référentiel (court, 20 entrées) — et le mode de prix, séparé.
 *
 *  UNITÉ : ce que l'on compte (un titre, un cahier, un cm²). Sur le devis : « 3 cahier ».
 *  MODE  : comment on facture (à l'unité, à l'heure, au forfait, sur devis).
 *
 * L'atelier, lui, n'est JAMAIS enfermé : `marketplace_binder_services.unit` reste un texte libre. Ce
 * vocabulaire ne fait que PROPOSER (« Autre » saisit n'importe quelle unité). Aucun mode de prix n'est
 * stocké en base dans cette PR : le pilote dira s'il devient utile.
 */
import type { PricingMode } from "./types";

export interface ReferenceUnit {
  /** La clé du référentiel (`unitCandidates`). */
  key: string;
  /** Ce qui s'écrit sur le devis, après la quantité. */
  value: string;
  /** Ce que lit le relieur dans la liste. */
  label: string;
}

export const REFERENCE_UNITS: readonly ReferenceUnit[] = [
  ["ouvrage", "par ouvrage"], ["volume", "par volume"], ["cahier", "par cahier"], ["feuillet", "par feuillet"],
  ["tranche", "par tranche"], ["plat", "par plat"], ["dos", "par dos"], ["garde", "par garde"], ["coin", "par coin"],
  ["coiffe", "par coiffe"], ["mors", "par mors"], ["nerf", "par nerf"], ["titre", "par titre"], ["ligne", "par ligne"],
  ["caractère", "par caractère"], ["pièce", "par pièce"], ["motif", "par motif"], ["boîte", "par boîte"],
  ["cm", "par cm"], ["cm²", "par cm²"],
].map(([key, label]) => ({ key, value: key, label }));

const BY_KEY = new Map(REFERENCE_UNITS.map((u) => [u.key, u]));

export const referenceUnit = (key: string): ReferenceUnit | undefined => BY_KEY.get(key);

/** Le libellé d'une unité stockée par l'atelier : celui du vocabulaire s'il y est, sinon son texte tel quel. */
export const unitLabel = (value: string | null): string | null => {
  if (!value) return null;
  return BY_KEY.get(value)?.label ?? value;
};

export const PRICING_MODE_LABELS: Record<PricingMode, string> = {
  per_unit: "à l'unité",
  hourly: "à l'heure",
  fixed: "au forfait",
  on_quote: "sur devis",
};

/** Ce que l'on pratique couramment, en une phrase — une information, jamais un prix. */
export function commonPracticeHint(unitKeys: readonly string[], modes: readonly PricingMode[]): string | null {
  const units = unitKeys.map((k) => referenceUnit(k)?.label).filter((l): l is string => Boolean(l));
  const parts = [...units, ...modes.filter((m) => m !== "per_unit").map((m) => PRICING_MODE_LABELS[m])];
  return parts.length ? parts.join(" · ") : null;
}
