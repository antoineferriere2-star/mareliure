import type { ServiceTaxCategory } from "./taxMatrix";

/** Instruction directe du propriétaire. Aucun avis professionnel n'est présumé. */
export const ADMINISTRATIVE_TAX_APPROVAL = {
  id: "oppe-administrative-tax-2026-10-06",
  approvedOn: "2026-10-06",
  authority: "project_owner",
  accountantValidated: false,
  legallyValidated: false,
  serviceRatesBps: { book_binding: 550, book_repair_restoration: 2000, non_book_object: 2000 },
  shippingRateBps: 2000,
  subscriptionVatRateBps: null,
  platformFeeVatRateBps: null,
} as const;

/** Référence de taux uniquement : la qualification de chaque nouveau devis reste explicite. */
export function administrativeRateApproval(input: {
  category: ServiceTaxCategory;
  serviceRateBps: number;
  shippingCents: number;
  shippingRateBps: number | null;
  shippingNature?: "autonomous" | "accessory" | "manual_review" | null;
}) {
  return {
    decision_id: ADMINISTRATIVE_TAX_APPROVAL.id,
    approved_on: ADMINISTRATIVE_TAX_APPROVAL.approvedOn,
    authority: ADMINISTRATIVE_TAX_APPROVAL.authority,
    accountant_validated: ADMINISTRATIVE_TAX_APPROVAL.accountantValidated,
    legally_validated: ADMINISTRATIVE_TAX_APPROVAL.legallyValidated,
    service_rate_approved: input.serviceRateBps === ADMINISTRATIVE_TAX_APPROVAL.serviceRatesBps[input.category],
    shipping_rate_approved: input.shippingCents > 0
      ? (input.shippingNature === "autonomous" && input.shippingRateBps === ADMINISTRATIVE_TAX_APPROVAL.shippingRateBps) ||
        (input.shippingNature === "accessory" && input.shippingRateBps === input.serviceRateBps &&
          input.serviceRateBps === ADMINISTRATIVE_TAX_APPROVAL.serviceRatesBps[input.category])
      : null,
  };
}
