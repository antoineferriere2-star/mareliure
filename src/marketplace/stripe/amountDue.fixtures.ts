/** Fixtures de test : un snapshot commercial tel que la validation fiscale l'écrit. */
import { recomputeProposalTax } from "@/marketplace/commercial/taxPolicy";
import type { AmountDueInput } from "./amountDue";

/** Un snapshot tel que la validation fiscale l'écrit : la même arithmétique, pas une seconde. */
export function amountInput(serviceCents: number, shippingCents: number, vatRateBps: number | null, over: Partial<AmountDueInput> = {}): AmountDueInput {
  const t = recomputeProposalTax(
    { customerServicePriceCents: serviceCents, shippingTotalCents: shippingCents, depositAmountCents: 0 },
    vatRateBps,
  );
  return {
    currency: "EUR",
    customerServicePriceCents: serviceCents,
    shippingTotalCents: shippingCents,
    customerVatRateBps: vatRateBps,
    customerVatAmountCents: t.customerVatAmountCents,
    customerTotalHtCents: t.customerTotalHtCents,
    customerTotalTtcCents: t.customerTotalTtcCents,
    depositType: "NONE",
    depositAmountCents: 0,
    ...over,
  };
}
