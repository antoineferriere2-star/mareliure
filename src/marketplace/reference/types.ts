/**
 * Le référentiel métier commun de la reliure — ce que TOUT relieur peut chercher, jamais ce qu'il facture.
 *
 * Principes (voir docs/CODEX_HANDOFF.md, « PR 2a ») :
 *  - une ressource VERSIONNÉE dans le code (`reliure-fr-v1`), pas des tables globales ;
 *  - une clé stable (`OPR-0001`) : le libellé peut changer, l'identité jamais ; aucune dépendance ne
 *    porte un slug ;
 *  - AUCUN PRIX : ni montant, ni tarif suggéré. Les prix appartiennent au catalogue de l'atelier ;
 *  - `needsBinderValidation` est une information INTERNE de pilotage : elle n'est jamais affichée au
 *    relieur.
 */

/** La nature d'une entrée. Seuls `operation`, `package` et `diagnostic` sont importables dans un catalogue. */
export const REFERENCE_KINDS = ["operation", "package", "diagnostic", "adjustment", "material_choice", "generic_quote"] as const;
export type ReferenceKind = (typeof REFERENCE_KINDS)[number];

/** Les natures qu'un relieur peut importer dans son catalogue : rien d'autre (ni ajustement, ni matériau, ni ligne générique). */
export const IMPORTABLE_KINDS: readonly ReferenceKind[] = ["operation", "package", "diagnostic"];

/** Une entrée est proposée à l'import seulement si elle est active ET d'une nature importable. */
export const isImportable = (operation: { kind: ReferenceKind; active: boolean }): boolean =>
  operation.active && IMPORTABLE_KINDS.includes(operation.kind);

/** Comment une prestation se facture couramment — une information, jamais un tarif. */
export type PricingMode = "per_unit" | "hourly" | "fixed" | "on_quote";
export type InterventionMode = "fabrication" | "reparation" | "restauration" | "conservation";

export interface ReferenceOperation {
  /** Stable entre versions : `OPR-0001`. */
  key: string;
  /** La version de la ressource dont vient cette entrée. */
  version: string;
  canonicalName: string;
  /** Le nom pour un particulier, seulement s'il diffère du nom canonique. */
  customerName: string | null;
  /** Code ASCII stable (`DORURE_TITRAGE`) ; son libellé est dans le manifeste. */
  domain: string;
  family: string;
  subfamily: string;
  kind: ReferenceKind;
  /** Une vraie variante d'une autre entrée (type de couture…). Jamais un prérequis. */
  variantOf: string | null;
  technicalDescription: string;
  customerDescription: string;
  synonyms: string[];
  searchKeywords: string[];
  /** Clés du vocabulaire contrôlé d'unités (`titre`, `cahier`…), jamais du texte libre. */
  unitCandidates: string[];
  pricingModes: PricingMode[];
  interventionModes: InterventionMode[];
  restorationRelated: boolean;
  gildingRelated: boolean;
  fineBinderyRelevant: boolean;
  customerVisible: boolean;
  standalone: boolean;
  /** INTERNE : à faire relire par un relieur du pilote. Jamais montré au relieur. */
  needsBinderValidation: boolean;
  confidence: string;
  sources: string[];
  internalNotes: string | null;
  /** `false` : retirée des propositions (elle reste dans la ressource et dans les liens existants). */
  active: boolean;
}

/** « `dependent` se pratique HABITUELLEMENT après ou avec `prerequisite` » — descriptif, jamais une contrainte. */
export interface OperationSequence {
  id: string;
  prerequisite: string;
  dependent: string;
  origin: "relations" | "entry_prerequisites";
  needsBinderValidation: boolean;
  notes: string | null;
}

/** « `composite` PEUT inclure `component` selon l'atelier ». */
export interface OperationComponent {
  id: string;
  composite: string;
  component: string;
  origin: "relations" | "commonly_bundled";
  needsBinderValidation: boolean;
  notes: string | null;
}

/** Deux stratégies distinctes selon l'ouvrage. Paire non orientée : `a` < `b`. */
export interface OperationAlternative {
  id: string;
  a: string;
  b: string;
  origin: "relations";
  needsBinderValidation: boolean;
  notes: string | null;
}

export interface ReferenceRelations {
  operation_sequences: OperationSequence[];
  operation_components: OperationComponent[];
  operation_alternatives: OperationAlternative[];
}

export interface ReferenceManifest {
  version: string;
  publishedOn: string;
  language: string;
  sourceDataset: { title: string; version: string; files: { name: string; sha256: string }[] };
  domains: Record<string, string>;
  sources: Record<string, string>;
  importableKinds: ReferenceKind[];
  counts: {
    operations: number;
    byKind: Record<ReferenceKind, number>;
    active: number;
    importable: number;
    needsBinderValidation: number;
    customerVisible: number;
    relations: { operation_sequences: number; operation_components: number; operation_alternatives: number };
    relationsNeedingValidation: number;
  };
}

export interface ReferenceData {
  manifest: ReferenceManifest;
  operations: readonly ReferenceOperation[];
  relations: ReferenceRelations;
}
