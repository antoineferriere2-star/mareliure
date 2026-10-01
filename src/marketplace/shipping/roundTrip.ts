/** Commercial decision for a single ordinary book, sent both ways inside mainland France. */
export const ROUND_TRIP_CUSTOMER_TTC_CENTS = 1_500;

export type RoundTripReason =
  | "address_review"
  | "outside_mainland"
  | "parcel_review"
  | "valuable_book"
  | "method_unconfirmed"
  | "cost_unconfirmed"
  | "cost_exceeds_price"
  | "economic_cost_unconfirmed"
  | "economic_cost_exceeds_revenue";

export interface RoundTripParcel {
  weightGrams: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
}

export interface RoundTripQuote {
  outboundTtcCents: number;
  returnTtcCents: number;
  labelFeesTtcCents: number;
  packagingTtcCents: number;
  otherKnownCostsTtcCents: number;
  /** Operator-reviewed after recoverable VAT, fees and packaging; never inferred from TTC. */
  estimatedEconomicCostCents: number | null;
  economicCostReference: string;
  methodReference: string;
  validUntil: string;
  bothDirectionsAvailable: boolean;
  customerAsSenderPermitted: boolean;
  entrustedBookConditionsReviewed: boolean;
}

export interface RoundTripEligibility {
  customerCountry: string;
  customerPostalCode: string;
  workshopCountry: string;
  workshopPostalCode: string;
  customerAddressVerified: boolean;
  workshopAddressVerified: boolean;
  workshopAgreedToReceive: boolean;
  heritageOrIrreplaceable: boolean;
  declaredValueBand: string | null;
  outboundParcel: RoundTripParcel;
  returnParcel: RoundTripParcel;
  quote: RoundTripQuote | null;
  now: string;
}

export type RoundTripDecision =
  | { eligible: true; customerTtcCents: 1_500; estimatedCostTtcCents: number;
      cashSpreadTtcCents: number; estimatedEconomicCostCents: number; estimatedNetMarginCents: number }
  | { eligible: false; reason: RoundTripReason; estimatedCostTtcCents: number | null;
      cashSpreadTtcCents: number | null; estimatedEconomicCostCents: number | null; estimatedNetMarginCents: number | null };

const natural = (n: number) => Number.isSafeInteger(n) && n >= 0;
const mainlandPostalCode = (code: string) => {
  if (!/^\d{5}$/.test(code)) return false;
  const district = Number(code.slice(0, 2));
  // Corse, Monaco, overseas and special territories need a separate live quote.
  return district >= 1 && district <= 95 && district !== 20;
};
const ordinaryParcel = ({ weightGrams, lengthMm, widthMm, heightMm }: RoundTripParcel) =>
  [weightGrams, lengthMm, widthMm, heightMm].every((n) => natural(n) && n > 0) &&
  weightGrams <= 500 && lengthMm <= 350 && widthMm <= 250 && heightMm <= 80;

/** The cap is a candidate, never a carrier promise; every leg and fee must have a real quote. */
export function evaluateRoundTrip(input: RoundTripEligibility): RoundTripDecision {
  const blocked = (reason: RoundTripReason, cost: number | null = null,
    economicCost: number | null = null): RoundTripDecision => ({
    eligible: false,
    reason,
    estimatedCostTtcCents: cost,
    cashSpreadTtcCents: cost === null ? null : ROUND_TRIP_CUSTOMER_TTC_CENTS - cost,
    estimatedEconomicCostCents: economicCost,
    estimatedNetMarginCents: economicCost === null ? null : 1_250 - economicCost,
  });
  if (!input.customerAddressVerified || !input.workshopAddressVerified || !input.workshopAgreedToReceive)
    return blocked("address_review");
  if (input.customerCountry !== "FR" || input.workshopCountry !== "FR" ||
      !mainlandPostalCode(input.customerPostalCode) || !mainlandPostalCode(input.workshopPostalCode))
    return blocked("outside_mainland");
  if (!ordinaryParcel(input.outboundParcel) || !ordinaryParcel(input.returnParcel))
    return blocked("parcel_review");
  if (input.heritageOrIrreplaceable || input.declaredValueBand !== "under_100")
    return blocked("valuable_book");
  const quote = input.quote;
  if (!quote) return blocked("cost_unconfirmed");
  if (!quote.bothDirectionsAvailable || !quote.customerAsSenderPermitted ||
      !quote.entrustedBookConditionsReviewed || !quote.methodReference.trim() ||
      !Number.isFinite(Date.parse(quote.validUntil)) || Date.parse(quote.validUntil) <= Date.parse(input.now))
    return blocked("method_unconfirmed");
  const parts = [quote.outboundTtcCents, quote.returnTtcCents, quote.labelFeesTtcCents,
    quote.packagingTtcCents, quote.otherKnownCostsTtcCents];
  if (!parts.every(natural) || quote.outboundTtcCents === 0 || quote.returnTtcCents === 0)
    return blocked("cost_unconfirmed");
  const cost = parts.reduce((sum, n) => sum + n, 0);
  if (cost > ROUND_TRIP_CUSTOMER_TTC_CENTS) return blocked("cost_exceeds_price", cost);
  const economicCost = quote.estimatedEconomicCostCents;
  if (economicCost === null || !natural(economicCost) || !quote.economicCostReference.trim())
    return blocked("economic_cost_unconfirmed", cost);
  if (economicCost > 1_250)
    return blocked("economic_cost_exceeds_revenue", cost, economicCost);
  return { eligible: true, customerTtcCents: ROUND_TRIP_CUSTOMER_TTC_CENTS,
    estimatedCostTtcCents: cost, cashSpreadTtcCents: ROUND_TRIP_CUSTOMER_TTC_CENTS - cost,
    estimatedEconomicCostCents: economicCost,
    estimatedNetMarginCents: 1_250 - economicCost };
}

/** Shipping must appear as exactly 15 EUR TTC after the validated tax rate is applied. */
export function roundTripBaseForValidatedVat(rateBps: number): number | null {
  if (!Number.isSafeInteger(rateBps) || rateBps < 0 || rateBps > 10_000) return null;
  const candidates: number[] = [];
  for (let base = 0; base <= ROUND_TRIP_CUSTOMER_TTC_CENTS; base++)
    if (base + Math.round(base * rateBps / 10_000) === ROUND_TRIP_CUSTOMER_TTC_CENTS)
      candidates.push(base);
  return candidates.length === 1 ? candidates[0] : null;
}
