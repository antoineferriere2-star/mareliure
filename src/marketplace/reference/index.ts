/**
 * L'accès au référentiel : versionné, chargé À LA DEMANDE (un import dynamique par version : le
 * navigateur ne le télécharge qu'en ouvrant le catalogue, le serveur le charge pour valider un lien).
 *
 * Ajouter `reliure-fr-v2` = un nouveau dossier + une ligne dans `LOADERS`. Les prestations d'atelier
 * gardent (version, clé) : une clé absente de la version courante se lit « retirée du référentiel »
 * sans rien réécrire.
 */
import type { ReferenceData, ReferenceManifest, ReferenceOperation, ReferenceRelations } from "./types";

export const CURRENT_REFERENCE_VERSION = "reliure-fr-v1";

const LOADERS = {
  "reliure-fr-v1": async (): Promise<ReferenceData> => {
    const [manifest, operations, relations] = await Promise.all([
      import("./reliure-fr-v1/manifest.json"),
      import("./reliure-fr-v1/operations.json"),
      import("./reliure-fr-v1/relations.json"),
    ]);
    return {
      manifest: manifest.default as unknown as ReferenceManifest,
      operations: operations.default as unknown as ReferenceOperation[],
      relations: relations.default as unknown as ReferenceRelations,
    };
  },
} as const satisfies Record<string, () => Promise<ReferenceData>>;

export type ReferenceVersionId = keyof typeof LOADERS;

export const isKnownReferenceVersion = (version: string): version is ReferenceVersionId => Object.hasOwn(LOADERS, version);

const cache = new Map<string, Promise<ReferenceData>>();

/** Charge (une seule fois) une version du référentiel. Lève si la version est inconnue. */
export function loadReference(version: string = CURRENT_REFERENCE_VERSION): Promise<ReferenceData> {
  if (!isKnownReferenceVersion(version)) return Promise.reject(new Error(`Version de référentiel inconnue : ${version}`));
  let loaded = cache.get(version);
  if (!loaded) {
    loaded = LOADERS[version]();
    cache.set(version, loaded);
  }
  return loaded;
}

export interface ReferenceLookup {
  operation: ReferenceOperation;
  manifest: ReferenceManifest;
}

/** Retrouve une entrée par (version, clé) — `null` si la version ou la clé n'existe pas. */
export async function findReferenceOperation(version: string, key: string): Promise<ReferenceLookup | null> {
  if (!isKnownReferenceVersion(version)) return null;
  const data = await loadReference(version);
  const operation = data.operations.find((o) => o.key === key);
  return operation ? { operation, manifest: data.manifest } : null;
}

export { IMPORTABLE_KINDS, isImportable } from "./types";
export type { ReferenceData, ReferenceKind, ReferenceManifest, ReferenceOperation, ReferenceRelations } from "./types";
