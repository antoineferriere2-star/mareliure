import { WORK_ITEMS } from "./catalog";

/** La version sépare les décisions tarifaires successives sans toucher aux devis figés. */
export const BASE_PRICE_REFERENCE_VERSION = "mareliure-base-prices-v1";

export const BASE_PRICE_PRICING_MODES = [
  "fixed",
  "unit",
  "starting_from",
  "manual_review",
] as const;
export type BasePricePricingMode = (typeof BASE_PRICE_PRICING_MODES)[number];

export const BASE_PRICE_STATUSES = ["draft", "published", "retired"] as const;
export type BasePriceStatus = (typeof BASE_PRICE_STATUSES)[number];

export const BASE_PRICE_CONFIDENCES = ["low", "medium", "high"] as const;
export type BasePriceConfidence = (typeof BASE_PRICE_CONFIDENCES)[number];

export const BASE_PRICE_MAPPING_TYPES = ["exact", "composite", "no_direct_match"] as const;
export type BasePriceMappingType = (typeof BASE_PRICE_MAPPING_TYPES)[number];

export interface PriceableServiceMapping {
  pricingKey: string;
  referenceOperationKeys: readonly string[];
  mappingType: BasePriceMappingType;
  /** Les OPR de repère aident l'admin ; ils ne sont jamais une fausse équivalence. */
  note: string | null;
}

/**
 * Contrat commercial → technique. Il n'emporte aucun montant : la grille
 * validée sera chargée en PR A2, dans la table dédiée.
 */
export const PRICEABLE_SERVICE_MAPPINGS: readonly PriceableServiceMapping[] = [
  { pricingKey: "reemboitage", referenceOperationKeys: ["OPR-0073"], mappingType: "exact", note: null },
  { pricingKey: "reparation_dos", referenceOperationKeys: ["OPR-0138", "OPR-0139", "OPR-0140"], mappingType: "composite", note: null },
  { pricingKey: "reparation_mors", referenceOperationKeys: ["OPR-0133"], mappingType: "exact", note: null },
  { pricingKey: "reparation_coiffes", referenceOperationKeys: ["OPR-0132"], mappingType: "exact", note: null },
  { pricingKey: "reparation_coins", referenceOperationKeys: ["OPR-0134"], mappingType: "exact", note: null },
  { pricingKey: "reparation_plats", referenceOperationKeys: ["OPR-0053", "OPR-0054", "OPR-0135"], mappingType: "composite", note: null },
  { pricingKey: "pages_detachees", referenceOperationKeys: ["OPR-0016", "OPR-0023", "OPR-0025"], mappingType: "composite", note: null },
  { pricingKey: "couture_partielle", referenceOperationKeys: ["OPR-0025"], mappingType: "exact", note: null },
  { pricingKey: "recouture_complete", referenceOperationKeys: ["OPR-0036"], mappingType: "exact", note: null },
  { pricingKey: "reparation_papier", referenceOperationKeys: ["OPR-0018", "OPR-0019", "OPR-0150", "OPR-0151", "OPR-0155"], mappingType: "composite", note: null },
  { pricingKey: "gardes_neuves", referenceOperationKeys: ["OPR-0087"], mappingType: "exact", note: null },
  { pricingKey: "pleine_toile", referenceOperationKeys: ["OPR-0062"], mappingType: "exact", note: null },
  { pricingKey: "demi_toile", referenceOperationKeys: ["OPR-0061"], mappingType: "no_direct_match", note: "Couvrure : repère seulement." },
  { pricingKey: "dos_cuir", referenceOperationKeys: ["OPR-0061", "OPR-0074"], mappingType: "no_direct_match", note: "Couvrure et parure : repères seulement." },
  { pricingKey: "demi_cuir", referenceOperationKeys: ["OPR-0065"], mappingType: "exact", note: null },
  { pricingKey: "demi_cuir_a_coins", referenceOperationKeys: ["OPR-0066"], mappingType: "exact", note: null },
  { pricingKey: "plein_cuir", referenceOperationKeys: ["OPR-0064"], mappingType: "exact", note: null },
  { pricingKey: "dorure_titrage", referenceOperationKeys: ["OPR-0103"], mappingType: "exact", note: null },
  { pricingKey: "dorure_auteur", referenceOperationKeys: ["OPR-0104"], mappingType: "exact", note: null },
  { pricingKey: "dorure_tomaison", referenceOperationKeys: ["OPR-0106"], mappingType: "exact", note: null },
  { pricingKey: "dorure_date", referenceOperationKeys: ["OPR-0105"], mappingType: "exact", note: null },
  { pricingKey: "dorure_initiales", referenceOperationKeys: ["OPR-0103", "OPR-0109"], mappingType: "no_direct_match", note: "Titrage ou dorure directe : repères seulement." },
  { pricingKey: "dorure_filets", referenceOperationKeys: ["OPR-0116"], mappingType: "exact", note: null },
  { pricingKey: "dorure_fleurons", referenceOperationKeys: ["OPR-0118"], mappingType: "exact", note: null },
  { pricingKey: "dorure_decor", referenceOperationKeys: ["OPR-0109", "OPR-0116", "OPR-0118", "OPR-0123"], mappingType: "composite", note: null },
  { pricingKey: "nerfs", referenceOperationKeys: ["OPR-0045"], mappingType: "exact", note: null },
  { pricingKey: "gardes_decorees", referenceOperationKeys: ["OPR-0084"], mappingType: "exact", note: null },
  { pricingKey: "papiers_marbres", referenceOperationKeys: ["OPR-0194"], mappingType: "no_direct_match", note: "Choix de papier décoré : repère seulement." },
  { pricingKey: "mosaique", referenceOperationKeys: ["OPR-0126"], mappingType: "exact", note: null },
  { pricingKey: "signet", referenceOperationKeys: [], mappingType: "no_direct_match", note: "Aucune opération technique autonome correspondante." },
  { pricingKey: "tranches", referenceOperationKeys: ["OPR-0091", "OPR-0092", "OPR-0093", "OPR-0094", "OPR-0095", "OPR-0096", "OPR-0097", "OPR-0098", "OPR-0099"], mappingType: "composite", note: null },
  { pricingKey: "decor_personnalise", referenceOperationKeys: ["OPR-0123", "OPR-0124", "OPR-0125", "OPR-0126"], mappingType: "composite", note: null },
  { pricingKey: "etui", referenceOperationKeys: ["OPR-0157"], mappingType: "exact", note: null },
  { pricingKey: "chemise", referenceOperationKeys: ["OPR-0161"], mappingType: "exact", note: null },
  { pricingKey: "boite", referenceOperationKeys: ["OPR-0163", "OPR-0164"], mappingType: "composite", note: null },
  { pricingKey: "coffret", referenceOperationKeys: ["OPR-0168"], mappingType: "exact", note: null },
  { pricingKey: "restauration_cuir", referenceOperationKeys: ["OPR-0136", "OPR-0137"], mappingType: "composite", note: null },
  { pricingKey: "restauration_papier", referenceOperationKeys: ["OPR-0150", "OPR-0151", "OPR-0152", "OPR-0153", "OPR-0154", "OPR-0155", "OPR-0156"], mappingType: "composite", note: null },
  { pricingKey: "restauration_cartonnage", referenceOperationKeys: ["OPR-0135", "OPR-0142", "OPR-0143"], mappingType: "composite", note: null },
  { pricingKey: "restauration_reliure_ancienne", referenceOperationKeys: ["OPR-0132", "OPR-0133", "OPR-0138", "OPR-0144", "OPR-0145"], mappingType: "composite", note: null },
  { pricingKey: "restauration_patrimoniale", referenceOperationKeys: ["OPR-0144", "OPR-0145", "OPR-0186"], mappingType: "no_direct_match", note: "Diagnostic et conservation : repères seulement." },
  { pricingKey: "rebind_collector", referenceOperationKeys: ["OPR-0071", "OPR-0064", "OPR-0065"], mappingType: "no_direct_match", note: "Bradel et reliures cuir : repères seulement." },
  { pricingKey: "nouvelle_couverture", referenceOperationKeys: ["OPR-0051", "OPR-0052", "OPR-0061"], mappingType: "composite", note: null },
  { pricingKey: "reliure_de_creation", referenceOperationKeys: ["OPR-0186"], mappingType: "no_direct_match", note: "Diagnostic sur devis : routage seulement." },
  { pricingKey: "projet_sur_mesure", referenceOperationKeys: ["OPR-0186"], mappingType: "no_direct_match", note: "Diagnostic sur devis : routage seulement." },
];

export interface BasePriceDraft {
  pricingMode: BasePricePricingMode;
  defaultUnitPriceCents: number | null;
  unit: string;
}

export interface BasePriceFilterableRow {
  label: string;
  pricingKey: string;
  pricingMode: BasePricePricingMode | null;
  defaultUnitPriceCents: number | null;
  needsHumanValidation: boolean;
  hasEntry: boolean;
}

export type BasePriceFilter = "all" | "numeric" | "manual_review" | "needs_validation" | "modified";

export function matchesBasePriceFilter(
  row: BasePriceFilterableRow,
  filter: BasePriceFilter,
  search: string,
): boolean {
  const needle = search.trim().toLocaleLowerCase("fr-FR");
  if (needle && !`${row.label} ${row.pricingKey}`.toLocaleLowerCase("fr-FR").includes(needle))
    return false;
  if (filter === "numeric") return row.defaultUnitPriceCents !== null;
  if (filter === "manual_review") return row.pricingMode === "manual_review";
  if (filter === "needs_validation") return row.needsHumanValidation;
  if (filter === "modified") return row.hasEntry;
  return true;
}

export function validateBasePriceDraft(draft: BasePriceDraft): string[] {
  const errors: string[] = [];
  if (!draft.unit.trim()) errors.push("L’unité est obligatoire.");
  if (draft.pricingMode === "manual_review" && draft.defaultUnitPriceCents !== null)
    errors.push("Un tarif sur étude ne porte pas de montant.");
  if (draft.pricingMode !== "manual_review" && draft.defaultUnitPriceCents === null)
    errors.push("Un montant est obligatoire hors sur étude.");
  if (draft.defaultUnitPriceCents !== null && draft.defaultUnitPriceCents < 0)
    errors.push("Le montant ne peut pas être négatif.");
  return errors;
}

export function mappingForPricingKey(pricingKey: string): PriceableServiceMapping {
  const mapping = PRICEABLE_SERVICE_MAPPINGS.find((item) => item.pricingKey === pricingKey);
  if (!mapping) throw new Error(`Mapping tarifaire absent : ${pricingKey}`);
  return mapping;
}

/** Le mapping est un contrat complet avec les 45 prestations commerciales. */
export function assertCompleteBasePriceMapping(): void {
  const known = new Set(WORK_ITEMS.map((item) => item.key));
  if (PRICEABLE_SERVICE_MAPPINGS.length !== known.size)
    throw new Error("Le mapping tarifaire ne couvre pas toutes les prestations.");
  for (const mapping of PRICEABLE_SERVICE_MAPPINGS)
    if (!known.has(mapping.pricingKey)) throw new Error(`Prestation inconnue : ${mapping.pricingKey}`);
}
