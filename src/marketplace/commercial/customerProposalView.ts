/**
 * Ce qu'un client a le droit de lire d'une proposition commerciale acceptée.
 *
 * Une liste blanche, construite champ par champ : jamais un `...proposal`.
 * La ligne de base contient la rémunération de l'atelier, la marge visée, les
 * planchers de contribution, le multiplicateur de marque, la provenance du
 * Pricebook, les règles de prix — rien de cela ne doit atteindre un
 * navigateur, et l'ajout d'une colonne à la table ne doit jamais changer ce
 * qu'un client reçoit. Un champ est exposé parce qu'il est écrit ici.
 *
 * Aucun calcul : les montants sont ceux du snapshot figé à l'acceptation
 * (immuable en base). Ce module ne recalcule ni HT, ni TVA, ni TTC.
 */
import type { PricingMode } from "@/marketplace/pricing/pricingMode";

/** Les seuls champs d'une proposition qu'un client peut lire. */
export interface CustomerProposalSource {
  pricingMode: PricingMode;
  currency: string;
  customerServicePriceCents: number;
  shippingTotalCents: number;
  customerTotalHtCents: number;
  customerVatRateBps: number | null;
  customerVatAmountCents: number | null;
  customerTotalTtcCents: number | null;
  estimateMinCents: number | null;
  estimateMaxCents: number | null;
  createdAt: string;
  acceptedAt: string | null;
}

export interface CustomerProposalView {
  pricingMode: PricingMode;
  currency: string;
  serviceCents: number;
  shippingCents: number;
  totalHtCents: number;
  /** `null` tant que la fiscalité n'est pas déterminée : jamais un taux deviné. */
  vatRateBps: number | null;
  vatCents: number | null;
  totalTtcCents: number | null;
  estimateMinCents: number | null;
  estimateMaxCents: number | null;
  preparedAt: string;
  confirmedAt: string | null;
}

export function toCustomerProposalView(source: CustomerProposalSource): CustomerProposalView {
  return {
    pricingMode: source.pricingMode,
    currency: source.currency,
    serviceCents: source.customerServicePriceCents,
    shippingCents: source.shippingTotalCents,
    totalHtCents: source.customerTotalHtCents,
    vatRateBps: source.customerVatRateBps,
    vatCents: source.customerVatAmountCents,
    totalTtcCents: source.customerTotalTtcCents,
    estimateMinCents: source.estimateMinCents,
    estimateMaxCents: source.estimateMaxCents,
    preparedAt: source.createdAt,
    confirmedAt: source.acceptedAt,
  };
}
