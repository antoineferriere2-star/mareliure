/**
 * De la prestation du catalogue à la ligne d'un devis — et le raccourci
 * « 220 × 145 × 32 mm ».
 *
 * Une ligne est une COPIE : libellé, prix et TVA sont recopiés au moment où on la
 * crée. Modifier le prix d'une ligne ne touche jamais le catalogue, et modifier
 * le catalogue plus tard ne touche jamais une ligne déjà créée.
 */
import type { VatRegime } from "./quoteCalc";
import { PRICEABLE_SERVICE_MAPPINGS } from "@/marketplace/pricing/basePrices";
import { CURRENT_REFERENCE_VERSION } from "@/marketplace/reference";

export interface CatalogService {
  id: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  unitPriceCents: number;
  /** `null` : le taux par défaut du profil. */
  vatRateBps: number | null;
  unit: string | null;
  referenceVersion?: string | null;
  referenceOperationKey?: string | null;
}

export interface QuoteLine {
  /** Clé locale stable (l'interface n'utilise jamais l'index comme identité). */
  key: string;
  /** Format auquel la prestation appartient. Absent seulement avant son ajout au constructeur. */
  blockKey?: string;
  serviceId: string | null;
  label: string;
  description: string;
  unit: string | null;
  quantity: number;
  unitPriceCents: number;
  /** Prix du catalogue au moment de l'ajout ; `null` pour une ligne libre. */
  catalogPriceCents: number | null;
  vatRateBps: number;
  /** Indication d'interface seulement : le devis enregistre toujours son snapshot. */
  priceSource: "catalog" | "base" | "manual";
  requiresManualPrice: boolean;
  referenceVersion?: string | null;
  referenceOperationKey?: string | null;
}

export function lineFromService(
  service: CatalogService,
  defaultVatRateBps: number,
  key: string,
): QuoteLine {
  return {
    key,
    serviceId: service.id,
    label: service.name,
    description: service.description ?? "",
    unit: service.unit,
    quantity: 1,
    unitPriceCents: service.unitPriceCents,
    catalogPriceCents: service.unitPriceCents,
    vatRateBps: service.vatRateBps ?? defaultVatRateBps,
    priceSource: "catalog",
    requiresManualPrice: false,
    referenceVersion: service.referenceVersion ?? null,
    referenceOperationKey: service.referenceOperationKey ?? null,
  };
}

export function lineFromBasePrice(
  service: { pricingKey: string; label: string; unit: string; unitPriceCents: number | null; pricingMode: string },
  defaultVatRateBps: number,
  key: string,
): QuoteLine {
  const mapping = PRICEABLE_SERVICE_MAPPINGS.find((item) => item.pricingKey === service.pricingKey);
  const exactKey = mapping?.mappingType === "exact" ? mapping.referenceOperationKeys[0] : null;
  return {
    key,
    serviceId: null,
    label: service.label,
    description: service.pricingMode === "manual_review" ? "Prestation sur étude — prix à définir pour ce devis." : "Tarif de base Ma Reliure",
    unit: service.unit,
    quantity: 1,
    // Une prestation sur étude ne reçoit jamais un zéro automatique : le validateur demandera un prix.
    unitPriceCents: service.unitPriceCents ?? 0,
    catalogPriceCents: null,
    vatRateBps: defaultVatRateBps,
    priceSource: "base",
    requiresManualPrice: service.pricingMode === "manual_review",
    referenceVersion: exactKey ? CURRENT_REFERENCE_VERSION : null,
    referenceOperationKey: exactKey,
  };
}

export function freeLine(defaultVatRateBps: number, key: string, label = ""): QuoteLine {
  return {
    key,
    serviceId: null,
    label,
    description: "",
    unit: null,
    quantity: 1,
    unitPriceCents: 0,
    catalogPriceCents: null,
    vatRateBps: defaultVatRateBps,
    priceSource: "manual",
    requiresManualPrice: false,
  };
}

/** Le prix de cette ligne diffère-t-il du catalogue (ajusté pour CE devis) ? */
export function isPriceAdjusted(line: Pick<QuoteLine, "catalogPriceCents" | "unitPriceCents">): boolean {
  return line.catalogPriceCents !== null && line.catalogPriceCents !== line.unitPriceCents;
}

/** En franchise en base, le taux enregistré sur une ligne est toujours 0. */
export function effectiveVatRateBps(line: Pick<QuoteLine, "vatRateBps">, regime: VatRegime): number {
  return regime === "FRANCHISE" ? 0 : line.vatRateBps;
}

// ---------------------------------------------------------------------------
// Dimensions
// ---------------------------------------------------------------------------

export interface Dimensions {
  heightMm: number | null;
  widthMm: number | null;
  spineMm: number | null;
}

/** « 220 × 145 × 32 mm », ou `null` si aucune dimension n'est connue. Les manquantes deviennent « – ». */
export function formatDimensions(d: Dimensions): string | null {
  const parts = [d.heightMm, d.widthMm, d.spineMm];
  if (parts.every((p) => p === null || p === undefined)) return null;
  return `${parts.map((p) => (p === null || p === undefined ? "–" : String(p))).join(" × ")} mm`;
}

/** Une saisie en millimètres (« 220 », « 220,5 ») → entier ≥ 1, ou `null` si vide/invalide. */
export function parseMillimetres(input: string): number | null {
  const value = Number(input.trim().replace(",", "."));
  if (!Number.isFinite(value) || value <= 0 || value > 2000) return null;
  return Math.round(value);
}
