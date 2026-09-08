import { CASE_ANSWER_VALUES } from "@/marketplace/cases/caseProfile";
import { PAYOUT_RULES, PRICING_POLICY } from "./pricing.rules";
import type {
  PricingInput,
  PricingPolicy,
  PricingReasonCode,
  PricingSuggestion,
  PricingValidation,
} from "./pricing.types";

function roundUp(value: number, increment: number): number {
  return Math.ceil(value / increment) * increment;
}

function add(
  current: number,
  amount: number,
  reason: PricingReasonCode,
  reasons: PricingReasonCode[],
): number {
  reasons.push(reason);
  return current + amount;
}

export function validateManagedPrice(
  customerPriceCents: number,
  binderPayoutCents: number,
  policy: PricingPolicy = PRICING_POLICY,
): PricingValidation {
  const errors: string[] = [];
  if (!Number.isInteger(customerPriceCents) || customerPriceCents <= 0)
    errors.push("Le prix client doit être un montant positif en centimes.");
  if (!Number.isInteger(binderPayoutCents) || binderPayoutCents <= 0)
    errors.push("La rémunération atelier doit être un montant positif en centimes.");
  if (binderPayoutCents > customerPriceCents)
    errors.push("La rémunération atelier ne peut pas dépasser le prix client.");

  const marginCents = customerPriceCents - binderPayoutCents;
  const marginBps =
    customerPriceCents > 0 ? Math.floor((marginCents * 10_000) / customerPriceCents) : 0;
  const minimumMarginCents = Math.max(
    policy.minimumMarginCents,
    Math.ceil((customerPriceCents * policy.minimumMarginBps) / 10_000),
  );
  if (marginCents < minimumMarginCents)
    errors.push("La marge est inférieure au minimum configuré.");

  return { valid: errors.length === 0, marginCents, marginBps, minimumMarginCents, errors };
}

/** Deterministic suggestion from structured answers only. */
export function suggestManagedPrice(
  input: PricingInput,
  policy: PricingPolicy = PRICING_POLICY,
): PricingSuggestion {
  const V = CASE_ANSWER_VALUES;
  const reasons: PricingReasonCode[] = ["BASE_WORK"];
  let payout = PAYOUT_RULES.baseByIntent[input.intent ?? ""] ?? PAYOUT_RULES.defaultBase;

  if (input.material === V.material.halfLeather)
    payout = add(payout, PAYOUT_RULES.material.demi_cuir, "HALF_LEATHER", reasons);
  else if (input.material === V.material.fullLeather)
    payout = add(payout, PAYOUT_RULES.material.plein_cuir, "FULL_LEATHER", reasons);
  else if (input.material === V.material.decoratedPaper)
    payout = add(payout, PAYOUT_RULES.material.papier_decore, "DECORATED_PAPER", reasons);

  if (
    input.condition.includes(V.condition.damagedSpine) ||
    input.spineCondition === V.spineCondition.fragile ||
    input.spineCondition === V.spineCondition.split ||
    input.spineCondition === V.spineCondition.missing
  )
    payout = add(payout, PAYOUT_RULES.damagedSpine, "DAMAGED_SPINE", reasons);

  if (input.boardCondition === V.boardCondition.detached)
    payout = add(payout, PAYOUT_RULES.detachedBoards, "DETACHED_BOARDS", reasons);
  if (
    input.sewingCondition === V.sewingCondition.someLoose ||
    input.sewingCondition === V.sewingCondition.detached
  )
    payout = add(payout, PAYOUT_RULES.sewingRepair, "SEWING_REPAIR", reasons);
  const pageRepairConditions: readonly string[] = [
    V.condition.detachedPages,
    V.condition.tornPages,
    V.condition.missingPages,
  ];
  if (input.condition.some((value) => pageRepairConditions.includes(value)))
    payout = add(payout, PAYOUT_RULES.pageRepair, "PAGE_REPAIR", reasons);

  if (input.finishes.includes(V.finishes.gilding))
    payout = add(payout, PAYOUT_RULES.gilding, "GILDING", reasons);
  if (input.finishes.includes(V.finishes.title))
    payout = add(payout, PAYOUT_RULES.title, "TITLE", reasons);
  if (input.finishes.includes(V.finishes.author))
    payout = add(payout, PAYOUT_RULES.author, "AUTHOR", reasons);
  if (input.finishes.includes(V.finishes.bands))
    payout = add(payout, PAYOUT_RULES.raisedBands, "RAISED_BANDS", reasons);
  if (input.finishes.includes(V.finishes.slipcase))
    payout = add(payout, PAYOUT_RULES.slipcase, "SLIPCASE", reasons);
  if ((input.heightCm ?? 0) > 35 || (input.widthCm ?? 0) > 27)
    payout = add(payout, PAYOUT_RULES.largeFormat, "LARGE_FORMAT", reasons);
  if ((input.thicknessCm ?? 0) > 12)
    payout = add(payout, PAYOUT_RULES.thickVolume, "THICK_VOLUME", reasons);

  const completeness = [
    input.intent,
    input.heightCm,
    input.widthCm,
    input.thicknessCm,
    input.material,
    input.spineCondition,
    input.sewingCondition,
  ].filter((value) => value !== null).length;
  const confidence = completeness >= 6 ? "high" : completeness >= 4 ? "medium" : "low";
  if (confidence === "low") reasons.push("INCOMPLETE_DETAILS");

  const rawCustomerPrice = Math.ceil((payout * 10_000) / (10_000 - policy.targetMarginBps));
  const customerPrice = roundUp(rawCustomerPrice, policy.roundingIncrementCents);
  const validation = validateManagedPrice(customerPrice, payout, policy);

  return {
    suggestedCustomerPriceCents: customerPrice,
    suggestedBinderPayoutCents: payout,
    suggestedMarginCents: validation.marginCents,
    suggestedMarginBps: validation.marginBps,
    confidence,
    reasons,
    ruleVersion: policy.version,
  };
}
