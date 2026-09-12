/**
 * Comment le prix de référence Ma Reliure devient un prix Fine Bindery (§13).
 *
 * `suggestManagedPrice` (pricing.engine.ts) ne connaît aucune marque : il
 * calcule un seul prix, celui que Ma Reliure facturerait pour ce travail à
 * partir du Pricebook et de sa marge. C'est délibérément ce prix-là —
 * *service*, marge Ma Reliure déjà incluse — qui sert de base au
 * multiplicateur, pas la rémunération de l'atelier : l'atelier est payé pareil
 * quelle que soit la marque qui a vendu le projet (§38, "même logique payout
 * atelier 80/20"). Les 30 % supplémentaires de Fine Bindery rémunèrent le
 * concierge et le service international, pas un travail d'atelier plus cher.
 *
 * Jamais un second Pricebook : ce fichier ne contient aucun montant, comme
 * pricing.engine.ts — seulement une règle appliquée à un prix qui vient d'être
 * calculé ailleurs.
 */
import { MARKETPLACE_BRAND_CONFIGS, type MarketplaceBrand } from "@/marketplace/brand/brandConfig";

/**
 * Aucun moteur fiscal n'existe pour aucune des deux marques aujourd'hui
 * (§14) : ni Ma Reliure ni Fine Bindery ne distinguent HT/TTC dans le code.
 * `TAX_REVIEW_REQUIRED` dit cet état honnêtement plutôt que de calculer un
 * montant. Une seule valeur pour l'instant — le type reste un type, pas un
 * enum d'une valeur, pour que la politique fiscale future s'y ajoute sans
 * casser les appelants.
 */
export const TAX_STATUSES = ["TAX_REVIEW_REQUIRED"] as const;
export type TaxStatus = (typeof TAX_STATUSES)[number];

export interface BrandServicePrice {
  /** Le prix service Ma Reliure, avant tout multiplicateur de marque. */
  baseServicePriceCents: number;
  /** Le multiplicateur réellement appliqué, gelé au moment du calcul (§65 — un snapshot, pas une relecture future de la config). */
  brandMultiplierBps: number;
  /** `baseServicePriceCents × brandMultiplierBps`, arrondi, puis plancher éventuel appliqué. */
  servicePriceCents: number;
  /** Vrai si le plancher international a relevé le prix au-dessus du calcul brut. */
  minimumApplied: boolean;
  taxStatus: TaxStatus;
}

/**
 * `baseServicePriceCents` doit déjà être un prix positif et chiffré — appeler
 * ceci pour un dossier `manual_review`/`MANUAL_STUDY` n'a pas de sens : ce
 * statut existe précisément pour dire qu'aucun prix automatique ne
 * s'applique (§15, "pour MANUAL_STUDY, le prix reste manuel"). L'appelant
 * (generateMarketplacePricing) ne l'invoque donc jamais dans ce cas.
 */
export function applyBrandServicePricing(
  baseServicePriceCents: number,
  brand: MarketplaceBrand,
  roundingIncrementCents: number,
): BrandServicePrice {
  const policy = MARKETPLACE_BRAND_CONFIGS[brand].pricingPolicy;

  const raw = (baseServicePriceCents * policy.serviceMultiplierBps) / 10_000;
  // Toujours arrondi vers le haut, jamais en faveur du prix affiché — même
  // règle que customerPriceForMargin (pricebook.ts), pour que Ma Reliure et
  // Fine Bindery arrondissent de la même façon.
  const multiplied = Math.ceil(raw / roundingIncrementCents) * roundingIncrementCents;

  const floor = policy.minimumServicePriceCents;
  const servicePriceCents = floor !== null ? Math.max(multiplied, floor) : multiplied;

  return {
    baseServicePriceCents,
    brandMultiplierBps: policy.serviceMultiplierBps,
    servicePriceCents,
    minimumApplied: floor !== null && servicePriceCents > multiplied,
    taxStatus: "TAX_REVIEW_REQUIRED",
  };
}
