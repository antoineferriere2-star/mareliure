export type ShippingTaxNature = "autonomous" | "accessory" | "manual_review";
/** Une ligne distincte ne prouve pas une prestation autonome. L'administration qualifie le cas. */
export function shippingTaxQualificationError(input: {
  shippingCents: number; nature: ShippingTaxNature | null | undefined;
  serviceRateBps: number; shippingRateBps: number | null; country: string;
}): string | null {
  if (input.shippingCents <= 0) return null;
  if (!input.nature) return "Qualifiez le transport : prestation autonome, accessoire ou examen individuel motivé.";
  if (input.shippingRateBps === null) return "Indiquez et justifiez le taux du transport.";
  if (input.country.toUpperCase() === "FR" && input.nature === "autonomous" && input.shippingRateBps !== 2000)
    return "Le transport autonome en France relève du taux normal à 20 %.";
  if (input.nature === "accessory" && input.shippingRateBps !== input.serviceRateBps)
    return "Le transport qualifié d’accessoire suit le taux de la prestation principale.";
  return null;
}
