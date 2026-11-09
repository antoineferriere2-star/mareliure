/**
 * L'admin confirme un envoi après avoir lu, dans l'aperçu, la rémunération de chaque atelier. Le
 * serveur la recalcule à l'envoi : si une condition commerciale a changé entre-temps, le montant
 * écrit différerait de celui qu'il a vu (revue Codex de #192, 9 novembre 2026). L'envoi est alors
 * refusé, et l'admin repasse par l'aperçu.
 */
export interface ResolvedPayout {
  payoutCents: number;
  manualRequired: boolean;
}

/** Les ateliers dont le montant recalculé n'est pas celui confirmé (ou absent de la confirmation). */
export function payoutsChangedSincePreview(
  binderIds: readonly string[],
  confirmed: Readonly<Record<string, number>>,
  resolved: ReadonlyMap<string, ResolvedPayout>,
): string[] {
  return binderIds.filter((id) => {
    const now = resolved.get(id);
    return !now || now.manualRequired || confirmed[id] !== now.payoutCents;
  });
}
