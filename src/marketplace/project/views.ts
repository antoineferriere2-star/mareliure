/**
 * Ce que chacun lit du travail commandé.
 *
 * L'atelier lit la photographie figée à la validation du prix : c'est le
 * périmètre contractuel, qu'il ne modifie pas. Jamais un montant : l'atelier
 * connaît sa rémunération par son offre, pas par le prix client ; le client
 * connaît son prix, pas la rémunération de l'atelier. Ce module ne manipule
 * donc que des libellés et des quantités.
 */
import { workItemLabel } from "@/marketplace/pricing/catalog";
import type { PricingSnapshot } from "@/marketplace/pricing/snapshot";

export interface OrderedWorkLine {
  label: string;
  quantity: number;
}

/**
 * Le travail d'un projet, de la source la plus sûre à la moins sûre : la
 * photographie validée, sinon — pour le client seulement, avant validation —
 * les travaux que le moteur a lus dans son Dossier.
 */
export function orderedWork(
  snapshot: Pick<PricingSnapshot, "operations"> | null | undefined,
  identifiedWorkItemKeys: readonly string[] = [],
): OrderedWorkLine[] {
  if (snapshot && snapshot.operations.length > 0)
    return snapshot.operations.map((operation) => ({
      label: operation.label,
      quantity: operation.quantity,
    }));
  return identifiedWorkItemKeys.map((key) => ({ label: workItemLabel(key), quantity: 1 }));
}

export function describeWork(lines: readonly OrderedWorkLine[]): string {
  return lines
    .map((line) => (line.quantity > 1 ? `${line.label} × ${line.quantity}` : line.label))
    .join(" · ");
}
