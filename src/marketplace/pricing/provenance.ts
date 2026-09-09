/**
 * D'où vient un chiffre, et ce qu'on a le droit d'en faire.
 *
 * Ma Reliure a failli vendre des tarifs inventés. Les montants du premier
 * moteur — 140 € pour une réparation, 200 € pour une belle reliure — avaient
 * été posés pour que le calcul produise quelque chose, jamais pour être payés
 * par quelqu'un. Rien dans le code ne les distinguait d'un tarif relevé chez
 * un relieur : même type, même colonne, même affichage.
 *
 * Ce module est cette distinction. Chaque montant du système porte désormais
 * sa provenance, et deux fonctions décident de ce qu'on peut en faire :
 * `canReachCustomer` pour un prix, `countsAsReference` pour une statistique.
 * Un placeholder ne franchit ni l'une ni l'autre.
 *
 * L'ordre du tableau est significatif : de la donnée la plus solide à la moins
 * solide. `strongerOf` s'en sert pour qualifier un ensemble — un agrégat ne
 * vaut jamais mieux que sa plus faible source.
 */

export const PRICE_PROVENANCES = [
  "REAL_VERIFIED",
  "ADMIN_VALIDATED",
  "DEMO",
  "PLACEHOLDER",
  "TEST_ONLY",
] as const;

export type PriceProvenance = (typeof PRICE_PROVENANCES)[number];

export const PROVENANCE_LABELS: Record<PriceProvenance, string> = {
  REAL_VERIFIED: "Relevé chez un relieur",
  ADMIN_VALIDATED: "Validé par Ma Reliure",
  DEMO: "Démonstration",
  PLACEHOLDER: "Valeur d'attente",
  TEST_ONLY: "Test uniquement",
};

export const PROVENANCE_DESCRIPTIONS: Record<PriceProvenance, string> = {
  REAL_VERIFIED:
    "Montant donné par un relieur identifié, daté, et vérifié. La seule donnée qui fait référence.",
  ADMIN_VALIDATED:
    "Prix arrêté par Ma Reliure et assumé commercialement. Peut être vendu, mais ne compte pas comme observation du marché.",
  DEMO: "Posé pour montrer le produit. Ne doit jamais atteindre un client.",
  PLACEHOLDER:
    "Posé pour que le moteur produise quelque chose en attendant le terrain. Ne doit jamais atteindre un client.",
  TEST_ONLY: "Fixture de test. N'existe pas hors des tests et de la base de développement.",
};

/**
 * Un montant peut-il être présenté à un client comme son prix ?
 *
 * Deux provenances seulement. Un tarif relevé chez un relieur est réel ; un
 * prix arrêté par Ma Reliure est assumé. Tout le reste est un chiffre de
 * travail, et un chiffre de travail affiché devient une promesse.
 */
export function canReachCustomer(provenance: PriceProvenance): boolean {
  return provenance === "REAL_VERIFIED" || provenance === "ADMIN_VALIDATED";
}

/**
 * Un montant compte-t-il dans une statistique de marché ?
 *
 * Plus strict que `canReachCustomer` : seul le terrain compte. Un prix décidé
 * par Ma Reliure est une décision, pas une observation — l'inclure dans la
 * médiane reviendrait à se citer soi-même comme source et à confirmer ses
 * propres hypothèses.
 */
export function countsAsReference(provenance: PriceProvenance): boolean {
  return provenance === "REAL_VERIFIED";
}

const RANK: Record<PriceProvenance, number> = {
  REAL_VERIFIED: 0,
  ADMIN_VALIDATED: 1,
  DEMO: 2,
  PLACEHOLDER: 3,
  TEST_ONLY: 4,
};

/** La provenance d'un ensemble : celle de sa source la plus faible. */
export function weakestOf(provenances: readonly PriceProvenance[]): PriceProvenance | null {
  if (provenances.length === 0) return null;
  return provenances.reduce((worst, current) => (RANK[current] > RANK[worst] ? current : worst));
}

/**
 * D'où Ma Reliure tient le chiffre, au sens de la conversation qui l'a produit.
 *
 * Distinct de la provenance : `source` dit comment on l'a appris,
 * `provenance` ce qu'on a le droit d'en faire. Un `binder_interview` est
 * normalement `REAL_VERIFIED`, mais il ne l'est qu'une fois vérifié — les deux
 * axes restent indépendants.
 */
export const RATE_SOURCES = [
  "binder_interview",
  "binder_import",
  "historical_order",
  "admin_entry",
] as const;

export type RateSource = (typeof RATE_SOURCES)[number];

export const RATE_SOURCE_LABELS: Record<RateSource, string> = {
  binder_interview: "Entretien avec le relieur",
  binder_import: "Grille transmise par le relieur",
  historical_order: "Commande réellement passée",
  admin_entry: "Saisie Ma Reliure",
};
