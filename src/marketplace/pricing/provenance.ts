/**
 * D'où vient un prix, et ce qu'on a le droit d'en faire.
 *
 * Ma Reliure fixe ses propres tarifs. Un montant n'a donc plus que quatre
 * origines possibles, et chacune dit ce qu'on peut en faire :
 *
 * - `WEB_REFERENCE_INITIAL` : la grille telle que la recherche web l'a
 *   initialisée. Utilisable par le simulateur, jamais promise à un client tant
 *   que Ma Reliure ne l'a pas validée ;
 * - `ADMIN_VALIDATED` : un prix de la grille arrêté par Ma Reliure ;
 * - `HISTORICAL_TRANSACTION` : un montant réellement payé sur une commande ;
 * - `CASE_OVERRIDE` : un prix fixé à la main sur un dossier, qui n'appartient
 *   qu'à ce dossier et ne touche pas la grille.
 *
 * Aucune ne vient d'un atelier : les ateliers n'ont pas de grille dans Ma
 * Reliure, ils reçoivent une proposition de rémunération.
 */

export const PRICE_PROVENANCES = [
  "WEB_REFERENCE_INITIAL",
  "ADMIN_VALIDATED",
  "HISTORICAL_TRANSACTION",
  "CASE_OVERRIDE",
] as const;

export type PriceProvenance = (typeof PRICE_PROVENANCES)[number];

/**
 * Les valeurs de l'ancien modèle, qui peuvent encore figurer dans des tables
 * dépréciées (`marketplace_binder_rates`). Nommées pour qu'on les reconnaisse
 * en lisant la base ; jamais proposées dans l'interface, jamais écrites.
 */
export const LEGACY_PROVENANCES = [
  "REAL_VERIFIED",
  "BINDER_DECLARED",
  "WEB_BENCHMARK",
  "DEMO",
  "PLACEHOLDER",
  "TEST_ONLY",
] as const;

export const PROVENANCE_LABELS: Record<PriceProvenance, string> = {
  WEB_REFERENCE_INITIAL: "Référence initiale web",
  ADMIN_VALIDATED: "Validé par Ma Reliure",
  HISTORICAL_TRANSACTION: "Commande réellement payée",
  CASE_OVERRIDE: "Prix fixé sur le dossier",
};

/** Les deux provenances qu'une ligne de la grille peut porter. */
export const GRID_PROVENANCES = [
  "WEB_REFERENCE_INITIAL",
  "ADMIN_VALIDATED",
] as const satisfies readonly PriceProvenance[];

export type GridProvenance = (typeof GRID_PROVENANCES)[number];

/**
 * Un montant peut-il être promis à un client ?
 *
 * Seulement s'il a été décidé par Ma Reliure : dans la grille, ou sur le
 * dossier lui-même. Une référence web initiale reste un chiffre de travail.
 */
export function canReachCustomer(provenance: PriceProvenance): boolean {
  return provenance === "ADMIN_VALIDATED" || provenance === "CASE_OVERRIDE";
}

/** Un montant peut-il apparaître sur `/tarifs` ? Seulement un prix de grille validé. */
export function isPublicProvenance(provenance: PriceProvenance): boolean {
  return provenance === "ADMIN_VALIDATED";
}
