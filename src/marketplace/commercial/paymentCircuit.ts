/**
 * Ce que rapporte un dossier à Oppe, selon son circuit — jamais selon la marque du site.
 *
 * - `legacy_resale` : activité A. Oppe vend la prestation pour son propre compte ; son revenu
 *   est la marge de revente (prix de vente HT − rémunération atelier HT), figée sur la
 *   proposition. Ce n'est pas une commission.
 * - `own_client` : activités B et C. L'atelier vend. Sur un encaissement traité en ligne par la
 *   plateforme, Oppe perçoit 3 % du TTC encaissé ; les frais Stripe sont distincts et à la
 *   charge de l'atelier. Un règlement direct (virement, chèque, espèces) ne rapporte rien.
 * - `network_sale` et `concierge` : retirés le 5 octobre 2026 (commission de 25 % et
 *   conciergerie séparée contredisaient le modèle A). Les lignes historiques restent lisibles,
 *   aucun revenu n'en est jamais déduit.
 */
export const PAYMENT_CIRCUITS = ["own_client", "network_sale", "concierge", "legacy_resale", "review_required"] as const;
export type PaymentCircuit = typeof PAYMENT_CIRCUITS[number];
export const RETIRED_PAYMENT_CIRCUITS: readonly PaymentCircuit[] = ["network_sale", "concierge"];

/** Frais plateforme de l'activité C : 3 % du TTC encaissé en ligne. */
export const OWN_CLIENT_PLATFORM_FEE_BPS = 300;

export interface FeeAgreement {
  acceptedAt: string;
  version: string;
  currency: string;
  basis: "collected_ttc";
  basisCents: number;
  agreedTotalCents: number;
  rateBps: number;
}

export type RevenueDecision =
  | { kind: "none"; amountCents: 0 }
  | { kind: "review_required" }
  | { kind: "resale_margin" }
  | { kind: "fee"; amountCents: number; currency: string; basis: FeeAgreement["basis"]; agreementVersion: string };

/** Frais plateforme arrondis une fois au centime (BigInt : ni dépassement ni flottant). */
export function platformFeeCents(collectedTtcCents: number, rateBps = OWN_CLIENT_PLATFORM_FEE_BPS): number {
  if (!Number.isSafeInteger(collectedTtcCents) || collectedTtcCents < 0) throw new RangeError("invalid_amount");
  return Number((BigInt(collectedTtcCents) * BigInt(rateBps) + 5000n) / 10000n);
}

/** Règle de prévision et de rapprochement : ne crée jamais de paiement, transfert ni facture. */
export function platformRevenue(input: {
  circuit: PaymentCircuit;
  collection: "platform" | "external";
  payment: "unpaid" | "pending" | "failed" | "paid";
  amountPaidCents: number;
  refundedCents: number;
  currency: string;
  agreement: FeeAgreement | null;
}): RevenueDecision {
  if (RETIRED_PAYMENT_CIRCUITS.includes(input.circuit) || input.circuit === "review_required") return { kind: "review_required" };
  if (input.circuit === "legacy_resale") return { kind: "resale_margin" };
  if (input.collection === "external") return { kind: "none", amountCents: 0 };
  if (input.payment !== "paid") return { kind: "none", amountCents: 0 };
  const a = input.agreement;
  if (!a?.acceptedAt || !a.version || a.currency.toLowerCase() !== input.currency.toLowerCase() ||
      a.rateBps !== OWN_CLIENT_PLATFORM_FEE_BPS || a.basis !== "collected_ttc" ||
      !Number.isSafeInteger(input.amountPaidCents) || input.amountPaidCents <= 0 ||
      a.agreedTotalCents !== input.amountPaidCents || a.basisCents !== input.amountPaidCents ||
      input.refundedCents !== 0) {
    return { kind: "review_required" };
  }
  return { kind: "fee", amountCents: platformFeeCents(a.basisCents), currency: a.currency, basis: a.basis, agreementVersion: a.version };
}
