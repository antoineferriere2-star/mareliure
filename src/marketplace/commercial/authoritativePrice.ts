/**
 * Le prix commercial d'un dossier : UNE source, validée par un humain (Phase 0 / P1-4).
 *
 * Défaut corrigé : `marketplace_cases` porte deux colonnes qui disent « le prix client » —
 * `customer_price_cents` (le prix RETENU, saisi puis validé par l'administrateur) et
 * `service_price_cents` (la sortie brute du moteur, écrite à la génération). L'administrateur corrige
 * puis valide 450 € ; la fonction de validation ne réécrivait `service_price_cents` que s'il était
 * vide. La proposition commerciale, elle, se construisait sur `service_price_cents` : le client
 * voyait « prix validé 450 € » dans sa liste et recevait une proposition à 500 €.
 *
 * Règle : la seule autorité est `customer_price_cents` d'un dossier dont le prix est `validated`.
 * `suggested_customer_price_cents` reste la trace de la suggestion initiale du moteur ; la
 * correction humaine se lit dans l'écart entre les deux. `service_price_cents` n'est plus lu par la
 * construction d'une proposition.
 *
 * Pur : aucune lecture, aucune écriture.
 */

export interface CasePriceFacts {
  pricingStatus: string | null;
  customerPriceCents: number | null;
  binderPayoutCents: number | null;
  /** La suggestion initiale du moteur (marque incluse) — jamais une autorité. */
  suggestedCustomerPriceCents: number | null;
}

export type AuthoritativePrice =
  | {
      ok: true;
      /** Le prix client validé — celui que la proposition fige. */
      priceCents: number;
      binderPayoutCents: number;
      /** La suggestion initiale, pour la traçabilité (`null` : prix saisi sans suggestion). */
      suggestedPriceCents: number | null;
      /** Un humain a retenu un prix différent de la suggestion. */
      correctedByHuman: boolean;
    }
  | { ok: false; reason: "price_not_validated" | "price_missing" };

const isPositiveCents = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n > 0;

export function authoritativeServicePrice(facts: CasePriceFacts): AuthoritativePrice {
  if (facts.pricingStatus !== "validated") return { ok: false, reason: "price_not_validated" };
  if (!isPositiveCents(facts.customerPriceCents) || !isPositiveCents(facts.binderPayoutCents)) {
    return { ok: false, reason: "price_missing" };
  }
  return {
    ok: true,
    priceCents: facts.customerPriceCents,
    binderPayoutCents: facts.binderPayoutCents,
    suggestedPriceCents: facts.suggestedCustomerPriceCents,
    correctedByHuman:
      facts.suggestedCustomerPriceCents !== null && facts.suggestedCustomerPriceCents !== facts.customerPriceCents,
  };
}

/**
 * Une proposition n'est présentable et acceptable que si elle porte encore le prix validé courant.
 * Un prix re-validé depuis sa création la rend périmée : il faut une nouvelle version, jamais
 * l'acceptation d'un prix que le dossier n'a plus.
 */
export function proposalCarriesCurrentPrice(
  proposalServicePriceCents: number,
  facts: Pick<CasePriceFacts, "pricingStatus" | "customerPriceCents">,
): boolean {
  return facts.pricingStatus === "validated" && facts.customerPriceCents === proposalServicePriceCents;
}
