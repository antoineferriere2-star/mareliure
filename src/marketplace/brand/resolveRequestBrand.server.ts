/**
 * Le seul endroit qui lit un Host de requête réel pour en tirer une marque.
 *
 * `getRequestHost` (TanStack Start) lit le Host de la requête HTTP en cours —
 * jamais un paramètre que le client contrôle. C'est la source d'autorité que
 * §4 exige : un `?brand=` resterait un avis, pas une décision.
 *
 * `MARKETPLACE_BRAND_OVERRIDE` (jamais `VITE_`-préfixé, donc jamais dans le
 * bundle client) permet la config explicite que §4 demande "en
 * développement" — utile en local, où le Host est `localhost:8080` et ne
 * correspond à aucune marque.
 */
import { getRequestHost } from "@tanstack/react-start/server";
import { createServerFn } from "@tanstack/react-start";
import {
  resolveMarketplaceBrandForHostname,
  type MarketplaceBrand,
} from "./brandConfig";

/** Pure function du header réellement lu — séparée pour rester testable sans requête HTTP. */
export function resolveMarketplaceBrandForRequest(
  hostHeader: string | null | undefined,
  override: string | null | undefined,
): MarketplaceBrand {
  if (override === "MA_RELIURE" || override === "FINE_BINDERY") return override;
  return resolveMarketplaceBrandForHostname(hostHeader);
}

export const getRequestMarketplaceBrand = createServerFn({ method: "GET" }).handler(
  async (): Promise<MarketplaceBrand> => {
    const host = getRequestHost();
    return resolveMarketplaceBrandForRequest(host, process.env.MARKETPLACE_BRAND_OVERRIDE);
  },
);
