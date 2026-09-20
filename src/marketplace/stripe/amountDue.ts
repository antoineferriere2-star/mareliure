/**
 * Le montant exigible d'une proposition acceptée — la SEULE source du montant
 * d'un Checkout et de ce que le webhook accepte comme « payé » (Phase 0, P1-1/P1-2).
 *
 * Défaut corrigé : le Checkout facturait des lignes HORS TAXE (`customerServicePriceCents`
 * + `shippingTotalCents`) alors que le client s'est engagé sur un TTC — la TVA validée par
 * l'administrateur n'était jamais encaissée. Ce module dérive le montant du snapshot commercial
 * figé, l'exprime TTC, et le vérifie de bout en bout : jamais un prix recalculé, jamais un montant
 * reçu du navigateur ou de Stripe pris pour argent comptant.
 *
 * Pur : pas de Stripe, pas de base de données.
 *
 * Acompte : un acompte est un paiement partiel dont le solde se règle plus tard. Ce parcours de
 * paiement en deux temps n'existe pas (une proposition = un Checkout = un `paid_at`) ; encaisser le
 * total, ou l'acompte marqué « payé », décrirait faussement la commande. Une proposition avec acompte
 * est donc BLOQUÉE (fail closed) tant que ce parcours n'est pas construit — jamais facturée au
 * mauvais montant.
 */

export type AmountDueBlock =
  | "amount_unresolved"
  | "amount_inconsistent"
  | "deposit_flow_unsupported"
  | "nothing_due";

/** Les seuls champs du snapshot commercial dont dépend le montant. */
export interface AmountDueInput {
  currency: string;
  customerServicePriceCents: number;
  shippingTotalCents: number;
  customerVatRateBps: number | null;
  customerVatAmountCents: number | null;
  customerTotalHtCents: number;
  /** `null` tant que la TVA n'est pas résolue. */
  customerTotalTtcCents: number | null;
  depositType: string;
  depositAmountCents: number;
}

export interface AmountDue {
  ok: true;
  /** Code ISO 4217 en minuscules, comme Stripe. */
  currency: string;
  /** Ce que le client doit payer maintenant : le TTC du snapshot. */
  amountCents: number;
  htCents: number;
  vatCents: number;
  /** Ligne « service » TTC + ligne « transport » TTC : leur somme vaut exactement `amountCents`. */
  serviceLineCents: number;
  shippingLineCents: number;
}

export type AmountDueResult = AmountDue | { ok: false; reason: AmountDueBlock; detail: string };

const isCents = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
const vatOf = (baseCents: number, rateBps: number) => Math.round((baseCents * rateBps) / 10_000);

const block = (reason: AmountDueBlock, detail: string): AmountDueResult => ({ ok: false, reason, detail });

export function resolveAmountDue(input: AmountDueInput): AmountDueResult {
  const currency = typeof input.currency === "string" ? input.currency.trim().toLowerCase() : "";
  if (!/^[a-z]{3}$/.test(currency)) return block("amount_inconsistent", "currency");

  if (![input.customerServicePriceCents, input.shippingTotalCents, input.customerTotalHtCents, input.depositAmountCents].every(isCents)) {
    return block("amount_inconsistent", "negative_or_fractional_amount");
  }

  // Un acompte, même à 0 déclaré « NONE » : seul « aucun acompte » est payable en une fois.
  if (input.depositType !== "NONE" || input.depositAmountCents > 0) {
    return block("deposit_flow_unsupported", `deposit_type=${input.depositType}`);
  }

  const rate = input.customerVatRateBps;
  if (rate === null || input.customerVatAmountCents === null || input.customerTotalTtcCents === null) {
    return block("amount_unresolved", "vat_not_resolved");
  }
  if (!Number.isSafeInteger(rate) || rate < 0 || !isCents(input.customerVatAmountCents) || !isCents(input.customerTotalTtcCents)) {
    return block("amount_inconsistent", "vat_fields");
  }

  // Le snapshot doit être cohérent avec lui-même : une ligne modifiée à la main, ou un bug
  // d'arrondi ailleurs, ne doit jamais devenir un montant encaissé.
  const ht = input.customerServicePriceCents + input.shippingTotalCents;
  if (ht !== input.customerTotalHtCents) return block("amount_inconsistent", "ht_total");
  const vat = vatOf(ht, rate);
  if (vat !== input.customerVatAmountCents) return block("amount_inconsistent", "vat_amount");
  if (ht + vat !== input.customerTotalTtcCents) return block("amount_inconsistent", "ttc_total");
  if (input.customerTotalTtcCents <= 0) return block("nothing_due", "zero_total");

  // Répartition de la TVA sur les deux lignes de sorte que leur somme soit EXACTEMENT le TTC :
  // la TVA du transport est arrondie seule, celle du service est le reste.
  const shippingVat = vatOf(input.shippingTotalCents, rate);
  const serviceVat = vat - shippingVat;
  return {
    ok: true,
    currency,
    amountCents: input.customerTotalTtcCents,
    htCents: ht,
    vatCents: vat,
    serviceLineCents: input.customerServicePriceCents + serviceVat,
    shippingLineCents: input.shippingTotalCents + shippingVat,
  };
}
