import type { PricingPolicy, PricingReasonCode } from "./pricing.types";

export const PRICING_POLICY: PricingPolicy = {
  version: "bookbinding-2026-09-08-v1",
  targetMarginBps: 1_800,
  minimumMarginBps: 1_500,
  minimumMarginCents: 2_000,
  roundingIncrementCents: 1_000,
};

export const PRICING_REASON_LABELS: Record<PricingReasonCode, string> = {
  BASE_WORK: "Travail de reliure",
  HALF_LEATHER: "Demi-cuir",
  FULL_LEATHER: "Plein cuir",
  DECORATED_PAPER: "Papier décoré",
  DAMAGED_SPINE: "Dos à reprendre",
  DETACHED_BOARDS: "Plats à reprendre",
  SEWING_REPAIR: "Cahiers à reprendre",
  PAGE_REPAIR: "Pages à réparer",
  GILDING: "Dorure",
  TITLE: "Titrage",
  AUTHOR: "Nom d’auteur",
  RAISED_BANDS: "Nerfs",
  SLIPCASE: "Étui",
  LARGE_FORMAT: "Grand format",
  THICK_VOLUME: "Volume épais",
  INCOMPLETE_DETAILS: "Détails incomplets",
};

export const PAYOUT_RULES = {
  baseByIntent: {
    reparer: 14_000,
    restaurer: 20_000,
    couverture: 16_000,
    belle_reliure: 20_000,
    collector: 23_000,
    // Embellir un livre déjà relié : de la dorure et du décor, pas une reliure
    // complète. Protéger : un étui ou une boîte, du cartonnage sur mesure.
    personnaliser: 9_000,
    proteger: 11_000,
    ne_sais_pas: 18_000,
  } as Record<string, number>,
  defaultBase: 18_000,
  material: {
    papier_decore: 5_000,
    demi_cuir: 8_000,
    plein_cuir: 18_000,
  } as Record<string, number>,
  damagedSpine: 4_000,
  detachedBoards: 4_000,
  sewingRepair: 4_000,
  pageRepair: 3_000,
  gilding: 2_000,
  title: 1_000,
  author: 500,
  raisedBands: 1_000,
  slipcase: 7_000,
  largeFormat: 4_000,
  thickVolume: 3_000,
} as const;
