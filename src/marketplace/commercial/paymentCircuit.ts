/** Commercial circuit belongs to the dossier, never to its site's brand. */
export const PAYMENT_CIRCUITS = ["own_client", "network_sale", "concierge", "legacy_resale", "review_required"] as const;
export type PaymentCircuit = typeof PAYMENT_CIRCUITS[number];

export interface FeeAgreement {
  acceptedAt: string;
  version: string;
  currency: string;
  basis: "service_ht" | "service_ttc" | "collected_ttc";
  basisCents: number;
  agreedTotalCents: number;
  rateBps: number;
}

export type RevenueDecision =
  | { kind: "none"; amountCents: 0 }
  | { kind: "review_required" }
  | { kind: "separate_coordination_invoice" }
  | { kind: "fee"; amountCents: number; currency: string; basis: FeeAgreement["basis"]; agreementVersion: string };

/** Forecast/settlement rule only: never creates a Stripe charge, transfer or invoice. */
export function platformRevenue(input: {
  circuit: PaymentCircuit;
  collection: "platform" | "external";
  payment: "unpaid" | "pending" | "failed" | "paid";
  amountPaidCents: number;
  refundedCents: number;
  currency: string;
  agreement: FeeAgreement | null;
}): RevenueDecision {
  if (input.circuit === "own_client" && input.collection === "external") return { kind: "none", amountCents: 0 };
  if (input.circuit === "concierge") return { kind: "separate_coordination_invoice" };
  if (input.circuit === "legacy_resale" || input.circuit === "review_required") return { kind: "review_required" };
  if (input.payment !== "paid") return { kind: "none", amountCents: 0 };
  const a = input.agreement;
  const rate = input.circuit === "own_client" ? 300 : 2500;
  if (!a?.acceptedAt || !a.version || a.currency.toLowerCase() !== input.currency.toLowerCase() ||
      !Number.isSafeInteger(a.basisCents) || a.basisCents < 0 || a.rateBps !== rate ||
      !Number.isSafeInteger(input.amountPaidCents) || input.amountPaidCents <= 0 ||
      !Number.isSafeInteger(a.agreedTotalCents) || a.agreedTotalCents !== input.amountPaidCents ||
      input.refundedCents !== 0 || a.basisCents > input.amountPaidCents ||
      (input.circuit === "network_sale" && a.basis !== "service_ht") ||
      (input.circuit === "own_client" && (a.basis !== "collected_ttc" || a.basisCents !== input.amountPaidCents))) {
    return { kind: "review_required" };
  }
  // BigInt avoids overflow/float errors. Stripe processing fees are not a second platform fee.
  const cents = (BigInt(a.basisCents) * BigInt(rate) + 5000n) / 10000n;
  return { kind: "fee", amountCents: Number(cents), currency: a.currency, basis: a.basis, agreementVersion: a.version };
}
