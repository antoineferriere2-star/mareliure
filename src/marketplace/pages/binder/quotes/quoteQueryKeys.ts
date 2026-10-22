/** Les clés React Query de l'outil devis → facture, et la conversion profil → saisie serveur. */
import type { BillingProfile } from "@/marketplace/quotes/quoteBuild";

export const PROFILE_QUERY_KEY = ["marketplace", "binder", "billing-profile"] as const;
export const CATALOG_KEY = ["marketplace", "binder", "catalog"] as const;
export const PRICING_CATALOG_KEY = ["marketplace", "binder", "pricing-catalog"] as const;
export const CLIENTS_KEY = ["marketplace", "binder", "clients"] as const;
export const QUOTES_KEY = ["marketplace", "binder", "quotes"] as const;
export const INVOICES_KEY = ["marketplace", "binder", "invoices"] as const;
export const OPERATION_PHOTOS_KEY = ["marketplace", "binder", "operation-photos"] as const;

/** Le profil tel que le serveur l'attend en écriture. */
export function profileToInput(profile: BillingProfile) {
  // Le préfixe en attente est calculé par le serveur : il ne s'écrit jamais depuis le navigateur.
  const {
    logoStoragePath: _path,
    logoUrl: _url,
    invoicePrefixPending: _pending,
    prefixPendingFromYear: _year,
    ...input
  } = profile;
  // Renvoyer le préfixe en cours effacerait le préfixe en attente : c'est celui demandé qui est réécrit.
  return { ...input, invoicePrefix: profile.invoicePrefixPending ?? profile.invoicePrefix };
}
