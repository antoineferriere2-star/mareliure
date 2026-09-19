/**
 * Le calcul d'un devis ou d'une facture de relieur — pur, en centimes entiers.
 *
 * C'est le SEUL endroit où un montant se calcule : le navigateur l'utilise pour
 * afficher le total en direct, le serveur le rappelle pour enregistrer (il ne
 * reçoit jamais un total), et la facture reprend les montants du devis sans rien
 * recalculer. Aucune virgule flottante sur les montants : quantité en centièmes,
 * prix en centimes, taux de TVA en points de base, arrondi « au plus proche,
 * demi vers le haut » posé une seule fois par étape.
 *
 * TVA : on additionne les montants HT PAR TAUX, puis on arrondit la TVA une fois
 * par taux — jamais ligne par ligne, ce qui ferait dériver le total de quelques
 * centimes. Régime « franchise en base » : aucun taux n'est appliqué.
 *
 * Rien ici ne connaît un régime fiscal particulier : c'est l'atelier qui choisit
 * son régime et ses taux ; ce module applique ce qu'on lui donne.
 */

export type VatRegime = "FRANCHISE" | "VAT_LIABLE";

export type DiscountInput =
  | { type: "NONE" }
  /** `bps` : points de base de remise sur le sous-total HT (1000 = 10 %). */
  | { type: "PERCENT"; bps: number }
  /** `cents` : remise fixe HT. */
  | { type: "AMOUNT"; cents: number };

export type DepositInput =
  | { type: "NONE" }
  /** `bps` : part du total TTC demandée en acompte (3000 = 30 %). */
  | { type: "PERCENT"; bps: number }
  | { type: "AMOUNT"; cents: number };

export interface CalcLine {
  /** Jusqu'à deux décimales (0,5 ; 2 ; 1,25). */
  quantity: number;
  /** Prix unitaire HT, en centimes. */
  unitPriceCents: number;
  /** Taux de TVA en points de base (2000 = 20 %) ; ignoré en franchise. */
  vatRateBps: number;
}

export interface VatGroup {
  vatRateBps: number;
  /** Base HT du groupe, remise déduite. */
  baseHtCents: number;
  vatCents: number;
}

export interface QuoteTotals {
  /** Total HT de chaque ligne, dans l'ordre reçu. */
  lineTotalsCents: number[];
  subtotalCents: number;
  discountCents: number;
  totalHtCents: number;
  vatBreakdown: VatGroup[];
  totalVatCents: number;
  totalTtcCents: number;
  depositCents: number;
  balanceCents: number;
}

/** Quotient entier arrondi au plus proche, demi vers le haut (n ≥ 0, d > 0). */
export function divRound(n: number, d: number): number {
  return Math.floor((2 * n + d) / (2 * d));
}

/** Quantité en centièmes entiers ; `NaN` si elle n'est pas exprimable en deux décimales. */
export function quantityToHundredths(quantity: number): number {
  const h = Math.round(quantity * 100);
  return Math.abs(quantity * 100 - h) < 1e-6 ? h : Number.NaN;
}

export function lineTotalCents(line: Pick<CalcLine, "quantity" | "unitPriceCents">): number {
  const hundredths = quantityToHundredths(line.quantity);
  if (!Number.isFinite(hundredths) || hundredths < 0 || line.unitPriceCents < 0) {
    throw new RangeError("Quantité ou prix invalide");
  }
  return divRound(hundredths * line.unitPriceCents, 100);
}

/** Répartit `total` entre les groupes proportionnellement à `weights`, somme exacte (plus grand reste). */
function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum === 0 || total === 0) return weights.map(() => 0);
  const base = weights.map((w) => Math.floor((total * w) / sum));
  let remainder = total - base.reduce((a, b) => a + b, 0);
  const order = weights
    .map((w, index) => ({ index, fraction: (total * w) % sum }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const { index } of order) {
    if (remainder <= 0) break;
    base[index] += 1;
    remainder -= 1;
  }
  return base;
}

export function computeQuote(input: {
  lines: readonly CalcLine[];
  vatRegime: VatRegime;
  discount?: DiscountInput;
  deposit?: DepositInput;
}): QuoteTotals {
  const discountInput = input.discount ?? { type: "NONE" };
  const depositInput = input.deposit ?? { type: "NONE" };

  const lineTotalsCents = input.lines.map(lineTotalCents);
  const subtotalCents = lineTotalsCents.reduce((a, b) => a + b, 0);

  let discountCents = 0;
  if (discountInput.type === "PERCENT") {
    if (discountInput.bps < 0 || discountInput.bps > 10_000) throw new RangeError("Remise invalide");
    discountCents = divRound(subtotalCents * discountInput.bps, 10_000);
  } else if (discountInput.type === "AMOUNT") {
    if (discountInput.cents < 0) throw new RangeError("Remise invalide");
    // Une remise ne rend jamais un document négatif.
    discountCents = Math.min(discountInput.cents, subtotalCents);
  }
  const totalHtCents = subtotalCents - discountCents;

  // HT par taux (en franchise : un seul groupe à 0 %).
  const rateOf = (line: CalcLine) => (input.vatRegime === "FRANCHISE" ? 0 : line.vatRateBps);
  const rates = [...new Set(input.lines.map(rateOf))].sort((a, b) => a - b);
  const groupSubtotals = rates.map((rate) =>
    input.lines.reduce((sum, line, i) => (rateOf(line) === rate ? sum + lineTotalsCents[i] : sum), 0),
  );
  // La remise se répartit sur les taux au prorata de leur base : la TVA suit le prix réellement facturé.
  const discountShares = allocate(discountCents, groupSubtotals);
  const vatBreakdown: VatGroup[] = rates.map((vatRateBps, i) => {
    const baseHtCents = groupSubtotals[i] - discountShares[i];
    return { vatRateBps, baseHtCents, vatCents: divRound(baseHtCents * vatRateBps, 10_000) };
  });

  const totalVatCents = vatBreakdown.reduce((a, g) => a + g.vatCents, 0);
  const totalTtcCents = totalHtCents + totalVatCents;

  let depositCents = 0;
  if (depositInput.type === "PERCENT") {
    if (depositInput.bps < 0 || depositInput.bps > 10_000) throw new RangeError("Acompte invalide");
    depositCents = divRound(totalTtcCents * depositInput.bps, 10_000);
  } else if (depositInput.type === "AMOUNT") {
    if (depositInput.cents < 0) throw new RangeError("Acompte invalide");
    depositCents = Math.min(depositInput.cents, totalTtcCents);
  }

  return {
    lineTotalsCents,
    subtotalCents,
    discountCents,
    totalHtCents,
    vatBreakdown,
    totalVatCents,
    totalTtcCents,
    depositCents,
    balanceCents: totalTtcCents - depositCents,
  };
}
