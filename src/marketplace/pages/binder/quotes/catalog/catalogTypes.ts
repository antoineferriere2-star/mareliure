/** Ce que l'écran lit d'une prestation de l'atelier — la forme de la réponse du serveur (`ServiceView`). */
export interface Service {
  id: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  unitPriceCents: number;
  vatRateBps: number | null;
  unit: string | null;
  isActive: boolean;
  isFavorite: boolean;
  /** Le lien facultatif au référentiel : les deux ensemble, ou aucun (prestation personnelle). */
  referenceVersion: string | null;
  referenceOperationKey: string | null;
}

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
}

export const REFERENCE_KEY = ["marketplace", "reference"] as const;
