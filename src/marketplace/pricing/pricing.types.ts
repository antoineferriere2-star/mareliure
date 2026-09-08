import type { CaseProfile } from "@/marketplace/cases/caseProfile";

export type PricingConfidence = "low" | "medium" | "high";

export type PricingReasonCode =
  | "BASE_WORK"
  | "HALF_LEATHER"
  | "FULL_LEATHER"
  | "DECORATED_PAPER"
  | "DAMAGED_SPINE"
  | "DETACHED_BOARDS"
  | "SEWING_REPAIR"
  | "PAGE_REPAIR"
  | "GILDING"
  | "TITLE"
  | "AUTHOR"
  | "RAISED_BANDS"
  | "SLIPCASE"
  | "LARGE_FORMAT"
  | "THICK_VOLUME"
  | "INCOMPLETE_DETAILS";

export interface PricingPolicy {
  version: string;
  targetMarginBps: number;
  minimumMarginBps: number;
  minimumMarginCents: number;
  roundingIncrementCents: number;
}

export interface PricingSuggestion {
  suggestedCustomerPriceCents: number;
  suggestedBinderPayoutCents: number;
  suggestedMarginCents: number;
  suggestedMarginBps: number;
  confidence: PricingConfidence;
  reasons: PricingReasonCode[];
  ruleVersion: string;
}

export interface PricingValidation {
  valid: boolean;
  marginCents: number;
  marginBps: number;
  minimumMarginCents: number;
  errors: string[];
}

export type PricingInput = Pick<
  CaseProfile,
  | "intent"
  | "heightCm"
  | "widthCm"
  | "thicknessCm"
  | "condition"
  | "spineCondition"
  | "boardCondition"
  | "sewingCondition"
  | "material"
  | "finishes"
  | "bandsCount"
>;
