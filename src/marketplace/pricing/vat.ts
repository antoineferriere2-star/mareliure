/**
 * La TVA, calculée à un seul endroit.
 *
 * Un prix se décide HT — c'est sur lui que se calcule la marge, la TVA n'étant
 * pas un revenu — et s'annonce TTC à un particulier. Entre les deux, une seule
 * fonction : si le Pricebook, le simulateur, le dossier et la page publique
 * arrondissaient chacun à leur façon, un même travail afficherait deux prix à
 * un centime près, et personne ne saurait lequel est le vrai.
 *
 * Le HT est la vérité stockée ; le TTC en est dérivé et figé à la publication.
 *
 * Le taux normal (20 %) s'applique aux travaux de reliure et de restauration,
 * qui sont des prestations de services. Le taux à retenir reste une décision
 * comptable d'OPPE SAS : chaque montant porte donc le taux qui lui a été
 * appliqué, plutôt que de supposer qu'il ne changera jamais.
 */

export const STANDARD_VAT_RATE_BPS = 2_000;

export interface PriceBreakdown {
  htCents: number;
  vatRateBps: number;
  vatCents: number;
  ttcCents: number;
}

function assertCents(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0)
    throw new RangeError(`${name} doit être un entier de centimes positif ou nul.`);
}

function assertRate(rateBps: number): void {
  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > 10_000)
    throw new RangeError("Le taux de TVA doit être un entier de points de base entre 0 et 10 000.");
}

/**
 * Division entière arrondie au plus proche, le demi vers le haut.
 *
 * Tout reste entier : pas de flottant sur de la monnaie, et un arrondi qui ne
 * dépend pas de la façon dont un moteur JavaScript représente 0,5.
 */
function roundedDivision(numerator: number, denominator: number): number {
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

/** La TVA due sur un montant HT, arrondie au centime. */
export function vatOf(htCents: number, vatRateBps: number = STANDARD_VAT_RATE_BPS): number {
  assertCents(htCents, "Le montant HT");
  assertRate(vatRateBps);
  return roundedDivision(htCents * vatRateBps, 10_000);
}

/** Du HT au TTC. C'est le sens normal : le HT est décidé, le TTC s'en déduit. */
export function fromHt(
  htCents: number,
  vatRateBps: number = STANDARD_VAT_RATE_BPS,
): PriceBreakdown {
  const vatCents = vatOf(htCents, vatRateBps);
  return { htCents, vatRateBps, vatCents, ttcCents: htCents + vatCents };
}

/**
 * Du TTC au HT, quand on part d'un prix affiché.
 *
 * La décomposition rendue retombe exactement sur le TTC donné. Repasser ce HT
 * dans `fromHt` peut en revanche différer d'un centime : c'est le prix de
 * l'arrondi, et la raison pour laquelle le HT, pas le TTC, est ce qu'on stocke.
 */
export function fromTtc(
  ttcCents: number,
  vatRateBps: number = STANDARD_VAT_RATE_BPS,
): PriceBreakdown {
  assertCents(ttcCents, "Le montant TTC");
  assertRate(vatRateBps);
  const htCents = roundedDivision(ttcCents * 10_000, 10_000 + vatRateBps);
  return { htCents, vatRateBps, vatCents: ttcCents - htCents, ttcCents };
}

export function formatVatRate(vatRateBps: number): string {
  return `${(vatRateBps / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;
}
