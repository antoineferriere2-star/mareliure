/**
 * Le mapping marque → Product Stripe (§5-7 du brief du 16 septembre 2026).
 *
 * Trois Products permanents seulement, jamais un Product par dossier, par
 * commande ou par atelier — Stripe n'est pas notre Pricebook, le montant est
 * toujours dynamique (`price_data`, jamais un Price Stripe fixe).
 * `scripts/setupStripeProducts.ts` crée ces trois Products une fois,
 * idempotent par metadata ; leurs identifiants vivent ici, en variables
 * d'environnement server-only, jamais en dur dans un composant React.
 */
import type { MarketplaceBrand } from "@/marketplace/brand/brandConfig";

export interface StripeProductIds {
  maReliureService: string;
  fineBinderyService: string;
  shipping: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} manquant — lancer scripts/setupStripeProducts.ts puis reporter l'ID obtenu.`,
    );
  }
  return value;
}

export function getStripeProductIds(): StripeProductIds {
  return {
    maReliureService: requireEnv("STRIPE_PRODUCT_MA_RELIURE_SERVICE"),
    fineBinderyService: requireEnv("STRIPE_PRODUCT_FINE_BINDERY_SERVICE"),
    shipping: requireEnv("STRIPE_PRODUCT_SHIPPING"),
  };
}

export function serviceProductIdForBrand(brand: MarketplaceBrand, ids: StripeProductIds): string {
  return brand === "FINE_BINDERY" ? ids.fineBinderyService : ids.maReliureService;
}
