import { quoteInput, type QuoteInput } from "./quoteInput";
import type { DocumentView } from "./quoteViews";

/** Copie le contenu figé d'un devis sans recopier son identité ni son statut. */
export function duplicateQuoteInput(source: DocumentView): QuoteInput {
  if (source.kind !== "quote") throw new Error("quote_required");
  const adjustment = (type: "NONE" | "PERCENT" | "AMOUNT", value: number) =>
    type === "PERCENT" ? { type, bps: value } as const : type === "AMOUNT" ? { type, cents: value } as const : { type: "NONE" } as const;
  const validityDays = source.validUntil
    ? Math.round((Date.parse(`${source.validUntil}T00:00:00Z`) - Date.parse(`${source.issueDate}T00:00:00Z`)) / 86_400_000)
    : null;
  return quoteInput.parse({
    ...(source.workId ? { workId: source.workId } : {}),
    clientId: source.client.id,
    client: {
      name: source.client.name, email: source.client.email, phone: source.client.phone,
      addressLine1: source.client.addressLine1, postalCode: source.client.postalCode,
      city: source.client.city, country: source.client.country,
    },
    book: source.book,
    lines: source.items.map((item) => ({
      serviceId: null, label: item.label, description: item.description, unit: item.unit,
      quantity: item.quantity, unitPriceCents: item.unitPriceCents,
      catalogPriceCents: item.catalogPriceCents, vatRateBps: item.vatRateBps,
      ...(item.referenceVersion && item.referenceOperationKey
        ? { referenceVersion: item.referenceVersion, referenceOperationKey: item.referenceOperationKey } : {}),
    })),
    discount: adjustment(source.discountType, source.discountValue),
    deposit: adjustment(source.depositType, source.depositValue),
    validityDays: validityDays && validityDays >= 1 && validityDays <= 365 ? validityDays : null,
    notes: source.notes,
  });
}
