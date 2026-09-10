/**
 * D'où vient un chiffre, et ce qu'on a le droit d'en faire.
 *
 * Ma Reliure a failli vendre des tarifs inventés. Les montants du premier
 * moteur — 140 € pour une réparation, 200 € pour une belle reliure — avaient
 * été posés pour que le calcul produise quelque chose, jamais pour être payés
 * par quelqu'un. Rien dans le code ne les distinguait d'un tarif relevé chez
 * un relieur : même type, même colonne, même affichage.
 *
 * Ce module est cette distinction. Chaque montant du système porte sa
 * provenance, et trois fonctions décident de ce qu'on peut en faire :
 * `canReachCustomer` pour le prix d'un dossier, `countsAsReference` pour une
 * statistique, `isPublicProvenance` pour la page publique. Un placeholder ne
 * franchit aucune des trois ; un prix lu sur le web non plus.
 *
 * L'ordre du tableau est significatif : de la donnée la plus solide à la moins
 * solide. `weakestOf` s'en sert pour qualifier un ensemble — un agrégat ne
 * vaut jamais mieux que sa plus faible source.
 */

export const PRICE_PROVENANCES = [
  "REAL_VERIFIED",
  "HISTORICAL_TRANSACTION",
  "ADMIN_VALIDATED",
  "BINDER_DECLARED",
  "WEB_BENCHMARK",
  "DEMO",
  "PLACEHOLDER",
  "TEST_ONLY",
] as const;

export type PriceProvenance = (typeof PRICE_PROVENANCES)[number];

export const PROVENANCE_LABELS: Record<PriceProvenance, string> = {
  REAL_VERIFIED: "Relevé chez un relieur",
  HISTORICAL_TRANSACTION: "Commande réellement payée",
  ADMIN_VALIDATED: "Validé par Ma Reliure",
  BINDER_DECLARED: "Déclaré, non confirmé",
  WEB_BENCHMARK: "Prix affiché sur le web",
  DEMO: "Démonstration",
  PLACEHOLDER: "Valeur d'attente",
  TEST_ONLY: "Test uniquement",
};

export const PROVENANCE_DESCRIPTIONS: Record<PriceProvenance, string> = {
  REAL_VERIFIED:
    "Montant donné par un relieur identifié, daté, et entendu de sa bouche. Fait référence.",
  HISTORICAL_TRANSACTION:
    "Montant effectivement payé à un atelier sur une commande passée. Fait référence.",
  ADMIN_VALIDATED:
    "Prix arrêté par Ma Reliure et assumé commercialement. Peut être vendu, mais ne compte pas comme observation du marché.",
  BINDER_DECLARED:
    "Montant attribué à un relieur mais pas encore confirmé par lui. Ne compte dans aucune médiane.",
  WEB_BENCHMARK:
    "Prix affiché publiquement par un atelier, relevé sur sa page. Un repère : jamais un prix Ma Reliure, jamais public, jamais une référence d'atelier.",
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
 * Plus strict que `canReachCustomer` : seul le terrain compte — ce qu'un
 * relieur a dit, ou ce qu'on lui a réellement payé. Un prix décidé par Ma
 * Reliure est une décision, pas une observation ; un prix affiché sur un site
 * n'a été confirmé par personne.
 */
export function countsAsReference(provenance: PriceProvenance): boolean {
  return provenance === "REAL_VERIFIED" || provenance === "HISTORICAL_TRANSACTION";
}

/**
 * Un montant peut-il apparaître sur une page publique (`/tarifs`) ?
 *
 * Une seule provenance : le prix que Ma Reliure a arrêté et publié. Même un
 * tarif d'atelier vérifié n'est pas un prix de vente — c'est ce que nous
 * payons, pas ce que nous vendons.
 */
export function isPublicProvenance(provenance: PriceProvenance): boolean {
  return provenance === "ADMIN_VALIDATED";
}

/**
 * Les provenances qu'une grille d'atelier peut porter.
 *
 * `WEB_BENCHMARK` en est exclu, et la base le refuse aussi : un prix lu sur un
 * site ne devient pas la grille d'un atelier, même par erreur de saisie.
 */
export const RATE_PROVENANCES = PRICE_PROVENANCES.filter(
  (provenance): provenance is Exclude<PriceProvenance, "WEB_BENCHMARK"> =>
    provenance !== "WEB_BENCHMARK",
);

const RANK: Record<PriceProvenance, number> = Object.fromEntries(
  PRICE_PROVENANCES.map((provenance, index) => [provenance, index]),
) as Record<PriceProvenance, number>;

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

/**
 * La provenance d'une ligne de grille qu'on enregistre.
 *
 * Une ligne non confirmée par le relieur était jusqu'ici écrite
 * `ADMIN_VALIDATED` — c'est-à-dire « vendable » — alors que personne ne
 * l'avait validée. Elle est désormais `BINDER_DECLARED` : visible, discutable,
 * mais hors de toute médiane et de tout prix.
 */
export function rateProvenanceFor(input: {
  verified: boolean;
  source: RateSource;
}): PriceProvenance {
  if (input.source === "historical_order") return "HISTORICAL_TRANSACTION";
  if (input.verified) return "REAL_VERIFIED";
  return "BINDER_DECLARED";
}
