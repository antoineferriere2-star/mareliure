/** Analyse documentaire et décision administrative du propriétaire, 7 octobre 2026.
 * OPPE est redevable et collecte la TVA (confirmation directe). Aucun avis professionnel présumé.
 */
export const WORKSHOP_TAX_DECISION = {
  id: "oppe-workshop-tax-2026-10-07", approvedOn: "2026-10-07",
  subscriptionNetCents: 1500, vatRateBps: 2000, subscriptionVatCents: 300,
  subscriptionGrossCents: 1800, feeBps: 300, feeVatIncluded: true,
  accountantValidated: false, legallyValidated: false,
} as const;

export type WorkshopTaxProfile = {
  country: string | null; postal_code: string | null; city: string | null;
  address_line1: string | null; legal_name: string | null; workshop_name: string | null;
  vat_regime: string | null; vat_number: string | null;
};

/** Le pays par défaut de l'annuaire n'est pas une preuve d'établissement. */
export function frenchWorkshopTaxEligibility(profile: WorkshopTaxProfile | null): string | null {
  if (!profile || !(profile.legal_name || profile.workshop_name)?.trim() ||
      !profile.address_line1?.trim() || !profile.city?.trim() || !profile.postal_code?.trim() ||
      !profile.country?.trim() || !profile.vat_regime)
    return "Complétez votre identité professionnelle, adresse d’établissement, pays et régime fiscal dans les paramètres de facturation.";
  if (profile.country.toUpperCase() !== "FR" || !/^\d{5}$/.test(profile.postal_code) || /^(97|98)/.test(profile.postal_code))
    return "Votre établissement nécessite une qualification fiscale individuelle. L’offre à TVA française de 20 % est ouverte uniquement en France métropolitaine ; contactez Oppe.";
  // La franchise du client ne modifie pas la TVA collectée par OPPE.
  return null;
}

export function isFrenchSubscriptionTaxRate(rate: {
  active: boolean; percentage: number; inclusive: boolean; country: string | null;
  tax_type?: string | null;
}): boolean {
  return rate.active && rate.percentage === 20 && !rate.inclusive && rate.country === "FR" && rate.tax_type === "vat";
}

/** 3 % TVA comprise : aucune seconde collecte. Arrondi au centime, TVA par différence. */
export function workshopFeeTax(grossCents: number) {
  if (!Number.isSafeInteger(grossCents) || grossCents < 0) throw new Error("invalid_fee_amount");
  const netCents = Math.round(grossCents * 10000 / 12000);
  return { grossCents, netCents, vatCents: grossCents - netCents };
}

/** Ventilation cumulative : l'avoir final restitue exactement la facture initiale. */
export function workshopFeeCredit(previousGross: number, refundedGross: number, invoiceGross: number) {
  if (previousGross > refundedGross || refundedGross > invoiceGross) throw new Error("invalid_fee_refund");
  const previous = workshopFeeTax(previousGross), current = workshopFeeTax(refundedGross);
  return { grossCents: current.grossCents - previous.grossCents,
    netCents: current.netCents - previous.netCents, vatCents: current.vatCents - previous.vatCents };
}
