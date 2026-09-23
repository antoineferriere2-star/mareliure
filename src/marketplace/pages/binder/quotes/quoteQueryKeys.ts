/** Les clés React Query de l'outil devis → facture, et la conversion profil → saisie serveur. */
import type { BillingProfile } from "@/marketplace/quotes/quoteBuild";

export const PROFILE_QUERY_KEY = ["marketplace", "binder", "billing-profile"] as const;
export const CATALOG_KEY = ["marketplace", "binder", "catalog"] as const;
export const CLIENTS_KEY = ["marketplace", "binder", "clients"] as const;
export const QUOTES_KEY = ["marketplace", "binder", "quotes"] as const;
export const INVOICES_KEY = ["marketplace", "binder", "invoices"] as const;

/** Le profil tel que le serveur l'attend en écriture. */
export function profileToInput(profile: BillingProfile) {
  const { logoStoragePath: _path, logoUrl: _url, ...input } = profile;
  return input;
}
