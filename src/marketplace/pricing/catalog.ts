/**
 * Le catalogue canonique des travaux de reliure.
 *
 * C'est le vocabulaire dans lequel Ma Reliure décrit un travail, et le seul
 * dans lequel un tarif peut être exprimé. Un relieur remplit sa grille sur ces
 * clés ; l'agrégation les compare ; le Pricebook les tarife ; le moteur les
 * additionne. Une clé est donc un identifiant machine stable : on en ajoute,
 * on en retire de la liste offerte, on n'en renomme jamais — exactement la
 * même discipline que les valeurs d'option du Playbook.
 *
 * Le catalogue vit ici plutôt qu'en base parce qu'il est le contrat que lit le
 * code : le moteur nomme `demi_cuir`, pas un identifiant opaque. La table
 * `marketplace_work_items` en est la projection administrable — elle porte les
 * ajouts faits depuis l'administration, et un test vérifie que toute clé
 * connue du code y figure. Le code reste la source de vérité pour ce qu'il
 * sait faire ; l'administration étend, elle ne redéfinit pas.
 *
 * Aucun montant ici. Un catalogue dit ce qu'on sait faire, pas ce que ça
 * coûte : les montants n'ont qu'une seule origine légitime, le terrain.
 */

export const WORK_FAMILIES = [
  { key: "repair", label: "Réparation / corps du livre" },
  { key: "cloth", label: "Reliure toile" },
  { key: "leather", label: "Reliure cuir" },
  { key: "gilding", label: "Dorure" },
  { key: "finishing", label: "Finitions" },
  { key: "protection", label: "Protection" },
  { key: "restoration", label: "Restauration" },
  { key: "creation", label: "Création" },
] as const;

export type WorkFamilyKey = (typeof WORK_FAMILIES)[number]["key"];

export const WORK_FAMILY_LABELS: Record<WorkFamilyKey, string> = Object.fromEntries(
  WORK_FAMILIES.map((family) => [family.key, family.label]),
) as Record<WorkFamilyKey, string>;

/**
 * `structure` : le travail principal, celui qui définit l'ouvrage rendu. Un
 * projet en porte au plus un — on ne relie pas un livre en plein cuir *et* en
 * demi-toile. `complement` : tout ce qui s'ajoute, et qui peut se cumuler.
 *
 * La distinction n'est pas cosmétique : elle dit à l'agrégation quoi comparer
 * (deux ateliers se comparent sur une structure) et au moteur quoi additionner.
 */
export type WorkRole = "structure" | "complement";

export interface WorkItem {
  key: string;
  label: string;
  family: WorkFamilyKey;
  role: WorkRole;
  /**
   * Un travail qui ne se tarife pas sur catalogue. Un ouvrage patrimonial se
   * regarde avant de se chiffrer : la présence d'un seul de ces travaux dans
   * un projet suffit à le sortir du calcul automatique.
   */
  requiresStudy?: boolean;
  /** Ce que le travail recouvre, pour la personne qui remplit une grille. */
  hint?: string;
}

export const WORK_ITEMS: readonly WorkItem[] = [
  // Réparation / corps du livre
  {
    key: "reemboitage",
    label: "Réemboîtage",
    family: "repair",
    role: "structure",
    hint: "Remettre le corps d'ouvrage dans sa couverture d'origine.",
  },
  { key: "reparation_dos", label: "Réparation du dos", family: "repair", role: "complement" },
  { key: "reparation_mors", label: "Réparation des mors", family: "repair", role: "complement" },
  {
    key: "reparation_coiffes",
    label: "Réparation des coiffes",
    family: "repair",
    role: "complement",
  },
  { key: "reparation_coins", label: "Réparation des coins", family: "repair", role: "complement" },
  { key: "reparation_plats", label: "Reprise des plats", family: "repair", role: "complement" },
  {
    key: "pages_detachees",
    label: "Pages détachées à remonter",
    family: "repair",
    role: "complement",
  },
  {
    key: "couture_partielle",
    label: "Couture partielle",
    family: "repair",
    role: "complement",
    hint: "Reprendre quelques cahiers désolidarisés.",
  },
  {
    key: "recouture_complete",
    label: "Recouture complète",
    family: "repair",
    role: "complement",
    hint: "Démonter et recoudre l'ensemble des cahiers.",
  },
  { key: "reparation_papier", label: "Réparation du papier", family: "repair", role: "complement" },
  { key: "gardes_neuves", label: "Gardes neuves", family: "repair", role: "complement" },

  // Reliure toile
  { key: "pleine_toile", label: "Pleine toile", family: "cloth", role: "structure" },
  { key: "demi_toile", label: "Demi-toile", family: "cloth", role: "structure" },

  // Reliure cuir
  { key: "dos_cuir", label: "Dos cuir", family: "leather", role: "structure" },
  { key: "demi_cuir", label: "Demi-cuir", family: "leather", role: "structure" },
  { key: "demi_cuir_a_coins", label: "Demi-cuir à coins", family: "leather", role: "structure" },
  { key: "plein_cuir", label: "Plein cuir", family: "leather", role: "structure" },

  // Dorure
  { key: "dorure_titrage", label: "Titrage", family: "gilding", role: "complement" },
  { key: "dorure_auteur", label: "Nom d'auteur", family: "gilding", role: "complement" },
  { key: "dorure_tomaison", label: "Tomaison", family: "gilding", role: "complement" },
  { key: "dorure_date", label: "Date", family: "gilding", role: "complement" },
  { key: "dorure_initiales", label: "Initiales", family: "gilding", role: "complement" },
  { key: "dorure_filets", label: "Filets", family: "gilding", role: "complement" },
  { key: "dorure_fleurons", label: "Fleurons", family: "gilding", role: "complement" },
  {
    key: "dorure_decor",
    label: "Décor doré",
    family: "gilding",
    role: "complement",
    hint: "Composition dorée, au-delà des fers isolés.",
  },

  // Finitions
  { key: "nerfs", label: "Nerfs", family: "finishing", role: "complement" },
  { key: "gardes_decorees", label: "Gardes décorées", family: "finishing", role: "complement" },
  { key: "papiers_marbres", label: "Papiers marbrés", family: "finishing", role: "complement" },
  { key: "mosaique", label: "Mosaïque de cuir", family: "finishing", role: "complement" },
  { key: "signet", label: "Signet", family: "finishing", role: "complement" },
  {
    key: "tranches",
    label: "Tranches (dorées, jaspées, peintes)",
    family: "finishing",
    role: "complement",
  },
  {
    key: "decor_personnalise",
    label: "Décor personnalisé",
    family: "finishing",
    role: "complement",
  },

  // Protection
  { key: "etui", label: "Étui", family: "protection", role: "structure" },
  { key: "chemise", label: "Chemise", family: "protection", role: "structure" },
  { key: "boite", label: "Boîte", family: "protection", role: "structure" },
  { key: "coffret", label: "Coffret", family: "protection", role: "structure" },

  // Restauration
  {
    key: "restauration_cuir",
    label: "Restauration du cuir existant",
    family: "restoration",
    role: "structure",
  },
  {
    key: "restauration_papier",
    label: "Restauration du papier",
    family: "restoration",
    role: "complement",
  },
  {
    key: "restauration_cartonnage",
    label: "Restauration du cartonnage",
    family: "restoration",
    role: "structure",
  },
  {
    key: "restauration_reliure_ancienne",
    label: "Restauration d'une reliure ancienne",
    family: "restoration",
    role: "structure",
  },
  {
    key: "restauration_patrimoniale",
    label: "Restauration patrimoniale",
    family: "restoration",
    role: "structure",
    requiresStudy: true,
    hint: "Sur étude. Ne se chiffre jamais sur catalogue.",
  },

  // Création
  { key: "rebind_collector", label: "Rebind collector", family: "creation", role: "structure" },
  {
    key: "nouvelle_couverture",
    label: "Nouvelle couverture",
    family: "creation",
    role: "structure",
  },
  {
    key: "reliure_de_creation",
    label: "Reliure de création",
    family: "creation",
    role: "structure",
    requiresStudy: true,
    hint: "Pièce unique dessinée avec le client. Sur étude.",
  },
  {
    key: "projet_sur_mesure",
    label: "Projet sur mesure",
    family: "creation",
    role: "structure",
    requiresStudy: true,
  },
];

const BY_KEY = new Map(WORK_ITEMS.map((item) => [item.key, item]));

export function workItem(key: string): WorkItem | null {
  return BY_KEY.get(key) ?? null;
}

export function workItemLabel(key: string): string {
  return BY_KEY.get(key)?.label ?? key;
}

export function workItemsByFamily(family: WorkFamilyKey): WorkItem[] {
  return WORK_ITEMS.filter((item) => item.family === family);
}

/** Un projet qui porte un de ces travaux sort du calcul automatique. */
export function requiresStudy(keys: readonly string[]): boolean {
  return keys.some((key) => BY_KEY.get(key)?.requiresStudy === true);
}

/**
 * Format et complexité : les deux axes qui font varier un même travail d'un
 * facteur deux. Ils sont déclarés sur la ligne de grille, pas déduits, parce
 * qu'un relieur sait dire « un demi-cuir grand format me prend une journée de
 * plus » et que personne ne sait le calculer à sa place.
 */
export const SIZE_CLASSES = ["small", "standard", "large", "oversize"] as const;
export type SizeClass = (typeof SIZE_CLASSES)[number];

export const SIZE_CLASS_LABELS: Record<SizeClass, string> = {
  small: "Petit format",
  standard: "Format courant",
  large: "Grand format",
  oversize: "Hors format",
};

export const COMPLEXITY_CLASSES = ["simple", "standard", "complex"] as const;
export type ComplexityClass = (typeof COMPLEXITY_CLASSES)[number];

export const COMPLEXITY_CLASS_LABELS: Record<ComplexityClass, string> = {
  simple: "Simple",
  standard: "Courant",
  complex: "Complexe",
};
