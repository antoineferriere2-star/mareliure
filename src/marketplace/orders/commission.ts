/**
 * What the platform keeps, and what the relieur is owed.
 *
 * Integer cents throughout, and the split is computed once here so the number
 * shown to the customer, the number shown to the artisan, and the number sent
 * to Stripe can never be three slightly different numbers. The relieur's share
 * is derived by subtraction rather than by a second rounding, which is what
 * guarantees the two halves always add back up to the gross.
 */
import { DEFAULT_COMMISSION_BPS } from "@/marketplace/config";

export interface AmountSplit {
  grossCents: number;
  commissionBps: number;
  commissionCents: number;
  binderCents: number;
}

/**
 * The rate to apply. A single function rather than reading the constant
 * directly, so a negotiated rate (per relieur, per campaign) has exactly one
 * place to be introduced later — and so no call site ever hardcodes 15 %.
 */
export function commissionBps(override?: number | null): number {
  if (override === undefined || override === null) return DEFAULT_COMMISSION_BPS;
  if (!Number.isInteger(override) || override < 0 || override > 10_000) {
    throw new Error(`Invalid commission rate: ${override} bps.`);
  }
  return override;
}

export function splitAmount(grossCents: number, bpsOverride?: number | null): AmountSplit {
  if (!Number.isInteger(grossCents) || grossCents <= 0) {
    throw new Error(`Quote amounts are positive integer cents; received ${grossCents}.`);
  }
  const bps = commissionBps(bpsOverride);
  const commissionCents = Math.round((grossCents * bps) / 10_000);
  return {
    grossCents,
    commissionBps: bps,
    commissionCents,
    binderCents: grossCents - commissionCents,
  };
}

/** Euro display for a cents amount, in the French convention (1 234,50 €). */
export function formatEuros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}
