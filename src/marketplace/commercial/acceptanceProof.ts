/**
 * Ce que le client accepte, prouvé : la version des conditions générales affichées et une
 * empreinte SHA-256 des termes du devis qu'il avait sous les yeux. Une modification ultérieure
 * de la ligne (impossible après acceptation, mais l'empreinte ne dépend pas de cette garantie)
 * se verrait par simple recalcul.
 */
import type { CommercialProposalRow } from "@/marketplace/services/commercialProposalRepository.server";

/** Version des conditions générales de vente présentées au client à l'acceptation. */
export const SALES_TERMS_VERSION = "cgv-oppe-2026-10-05";

type ProofInput = Pick<
  CommercialProposalRow,
  | "id" | "caseId" | "version" | "brand" | "currency" | "customerServicePriceCents" | "shippingTotalCents"
  | "customerVatRateBps" | "customerVatAmountCents" | "customerTotalHtCents" | "customerTotalTtcCents"
  | "depositAmountCents" | "workshopLeadTimeDays" | "workshopServiceDescription" | "shippingOfferKind"
>;

/** Texte canonique, champs dans un ordre fixe : deux calculs du même devis donnent la même empreinte. */
export function acceptanceCanonicalText(p: ProofInput, termsVersion = SALES_TERMS_VERSION): string {
  return JSON.stringify([
    "oppe-acceptance-v1", termsVersion, p.id, p.caseId, p.version, p.brand, p.currency,
    p.customerServicePriceCents, p.shippingTotalCents, p.shippingOfferKind, p.customerVatRateBps,
    p.customerVatAmountCents, p.customerTotalHtCents, p.customerTotalTtcCents, p.depositAmountCents,
    p.workshopLeadTimeDays, p.workshopServiceDescription,
  ]);
}

export async function acceptanceSnapshotSha256(p: ProofInput, termsVersion = SALES_TERMS_VERSION): Promise<string> {
  const bytes = new TextEncoder().encode(acceptanceCanonicalText(p, termsVersion));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
