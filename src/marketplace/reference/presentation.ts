/**
 * Ce que le relieur lit d'une entrée du référentiel. Aucun prix, aucun badge « à valider ».
 */
import { normalizeSearch } from "./search";
import type { ReferenceManifest, ReferenceOperation } from "./types";

/** Le nom proposé au relieur : celui d'un particulier s'il existe, sinon le nom canonique. Modifiable. */
export const suggestedName = (operation: Pick<ReferenceOperation, "canonicalName" | "customerName">): string =>
  operation.customerName ?? operation.canonicalName;

/**
 * « Dorure & titrage › Titrage » : le domaine puis la famille, sans répéter ce qui se répète
 * (« Couvrure › Couvrure » devient « Couvrure › Matériau et structure »).
 */
export function referencePath(operation: Pick<ReferenceOperation, "domain" | "family" | "subfamily">, manifest: Pick<ReferenceManifest, "domains">): string {
  const parts = [manifest.domains[operation.domain] ?? operation.domain, operation.family, operation.subfamily].filter(Boolean);
  const deduped = parts.filter((part, i) => i === 0 || normalizeSearch(part) !== normalizeSearch(parts[i - 1]));
  return deduped.slice(0, 2).join(" › ");
}
