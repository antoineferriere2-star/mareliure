/**
 * Deux marques commerciales, une seule plateforme (audit du 12 septembre
 * 2026, "Fine Bindery" — voir docs/fine-bindery-product-spec.md quand il
 * existera).
 *
 * Ceci est un second axe, indépendant de `src/brand.ts` :
 *
 * - `src/brand.ts` (`PublicBrand`, "metre" | "mareliure") décide QUEL
 *   déploiement ceci est — un réglage de build, lu une fois par
 *   `VITE_PUBLIC_BRAND`, qui reste inchangé. Fine Bindery n'y ajoute rien :
 *   il vit dans le même déploiement que Ma Reliure ("mareliure"), parce que
 *   les deux marques partagent le même projet Supabase — contrairement à
 *   Métré Build, qui a le sien.
 * - Ce fichier décide QUELLE MARQUE, à l'intérieur de ce déploiement
 *   marketplace, sert la requête en cours — résolu par nom d'hôte, à chaque
 *   requête, jamais par un paramètre que le client contrôlerait (§4 du
 *   brief : `?brand=` n'est jamais une source d'autorité).
 *
 * N'est donc jamais importé par Métré Build ni par du code qui ne sait pas
 * déjà que le marketplace existe.
 */
import type { SupportedLocale } from "@/build/i18n/locales";

export const MARKETPLACE_BRANDS = ["MA_RELIURE", "FINE_BINDERY"] as const;
export type MarketplaceBrand = (typeof MARKETPLACE_BRANDS)[number];

/** A `marketplace_cases.brand` column reads back as a plain string — this narrows it. */
export function isMarketplaceBrand(value: string): value is MarketplaceBrand {
  return (MARKETPLACE_BRANDS as readonly string[]).includes(value);
}

/**
 * Un Host qui ne correspond à aucune marque connue (déploiement de prévisualisation,
 * `*.workers.dev`, faute de frappe DNS) retombe ici plutôt que de deviner.
 * Ma Reliure, jamais Fine Bindery : la marque internationale ne doit jamais
 * apparaître par accident sur un hôte non reconnu (§57 — "pas de fuite Fine
 * Bindery sur Ma Reliure ou inversement").
 */
export const DEFAULT_MARKETPLACE_BRAND: MarketplaceBrand = "MA_RELIURE";

export interface MarketplacePricingPolicy {
  /**
   * Appliqué au prix de service HT du référentiel Ma Reliure — jamais un
   * second Pricebook (§13). 10 000 = ×1,00 (prix de référence inchangé),
   * 13 000 = ×1,30. Toujours avant taxe : voir `taxPolicy`.
   */
  serviceMultiplierBps: number;
  /**
   * Plancher configurable (§15) — délibérément absent (`null`) tant qu'aucune
   * valeur n'a été validée par un admin. Un seuil international ne doit pas
   * apparaître silencieusement parce qu'un objet de configuration a besoin
   * d'un nombre : Phase C tranchera où cette valeur est réellement stockée
   * (config statique vs table admin) avant de lui donner un montant.
   */
  minimumServicePriceCents: number | null;
}

export interface MarketplaceMessagingPolicy {
  /**
   * Ma Reliure : un seul fil, client/atelier/admin (modèle actuel de
   * `marketplace_messages`, voir conversation.ts). Fine Bindery : jamais —
   * deux canaux étanches (Phase G), le client ne voit jamais le canal
   * atelier et réciproquement (§26).
   */
  customerWorkshopDirectMessaging: boolean;
}

export interface MarketplaceSeoConfig {
  /** Sans slash final — voir `canonicalHome()`. */
  canonicalOrigin: string;
}

export interface MarketplaceContactIdentity {
  senderName: string;
  senderEmail: string;
}

export interface MarketplaceBrandConfig {
  id: MarketplaceBrand;
  /**
   * En minuscules, sans port. `www.` est une entrée à part entière : on ne
   * la déduit pas automatiquement, pour qu'un hôte accepté soit toujours un
   * hôte explicitement listé, jamais un pattern.
   */
  hostnames: readonly string[];
  displayName: string;
  defaultLocale: SupportedLocale;
  /** International = clientèle hors France, concierge requis, ateliers sélectionnés séparément. */
  international: boolean;
  pricingPolicy: MarketplacePricingPolicy;
  messaging: MarketplaceMessagingPolicy;
  /**
   * Le client a un interlocuteur nommé plutôt qu'un contact générique — et
   * jamais l'atelier directement (§2, §25). `false` pour Ma Reliure : rien
   * n'empêche un futur mode concierge, mais aucune UI n'y correspond
   * aujourd'hui.
   */
  conciergeRequired: boolean;
  contactIdentity: MarketplaceContactIdentity;
  seo: MarketplaceSeoConfig;
}

export const MARKETPLACE_BRAND_CONFIGS: Readonly<Record<MarketplaceBrand, MarketplaceBrandConfig>> = {
  MA_RELIURE: {
    id: "MA_RELIURE",
    hostnames: ["mareliure.fr", "www.mareliure.fr"],
    displayName: "Ma Reliure",
    defaultLocale: "fr-FR",
    international: false,
    pricingPolicy: {
      serviceMultiplierBps: 10_000,
      minimumServicePriceCents: null,
    },
    messaging: {
      customerWorkshopDirectMessaging: true,
    },
    conciergeRequired: false,
    contactIdentity: {
      senderName: "Ma Reliure",
      senderEmail: "noreply@mareliure.fr",
    },
    seo: {
      canonicalOrigin: "https://mareliure.fr",
    },
  },
  FINE_BINDERY: {
    id: "FINE_BINDERY",
    hostnames: ["finebindery.com", "www.finebindery.com"],
    displayName: "Fine Bindery",
    defaultLocale: "en-US",
    international: true,
    pricingPolicy: {
      // §13 : prix de référence Ma Reliure + 30 %, hors transport.
      serviceMultiplierBps: 13_000,
      minimumServicePriceCents: null,
    },
    messaging: {
      customerWorkshopDirectMessaging: false,
    },
    conciergeRequired: true,
    contactIdentity: {
      // Placeholder : le domaine finebindery.com n'est pas encore vérifié
      // dans Resend. Ne pas utiliser tant que l'envoi n'est pas confirmé —
      // voir Phase F (e-mails brand-aware).
      senderName: "Fine Bindery",
      senderEmail: "noreply@finebindery.com",
    },
    seo: {
      canonicalOrigin: "https://finebindery.com",
    },
  },
};

/** `mareliure.fr`, pas `MaReliure.fr:443` — la forme sous laquelle un Host s'écrit dans hostnames. */
function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/:\d+$/, "");
}

const HOSTNAME_TO_BRAND = new Map<string, MarketplaceBrand>(
  MARKETPLACE_BRANDS.flatMap((brand) =>
    MARKETPLACE_BRAND_CONFIGS[brand].hostnames.map((hostname) => [hostname, brand] as const),
  ),
);

/**
 * Pure, sans dépendance au serveur — le nom d'hôte est déjà résolu par
 * l'appelant (`resolveRequestMarketplaceBrand.server.ts` pour une requête
 * réelle, un test pour le reste). Jamais appelée avec une valeur envoyée par
 * le client comme source d'autorité (§4) : la seule source légitime est le
 * Host de la requête HTTP, lu côté serveur.
 */
export function resolveMarketplaceBrandForHostname(
  hostname: string | null | undefined,
): MarketplaceBrand {
  if (!hostname) return DEFAULT_MARKETPLACE_BRAND;
  return HOSTNAME_TO_BRAND.get(normalizeHostname(hostname)) ?? DEFAULT_MARKETPLACE_BRAND;
}

export function marketplaceBrandConfig(brand: MarketplaceBrand): MarketplaceBrandConfig {
  return MARKETPLACE_BRAND_CONFIGS[brand];
}

/** Le domaine canonique, avec son slash final — même convention que `MARELIURE_CANONICAL_HOME`. */
export function canonicalHome(brand: MarketplaceBrand): string {
  return `${MARKETPLACE_BRAND_CONFIGS[brand].seo.canonicalOrigin}/`;
}
