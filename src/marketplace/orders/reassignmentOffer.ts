/**
 * Proposer une commande à un nouvel atelier (réattribution) : faut-il réécrire l'offre ?
 *
 * Le bouton de l'admin redevient cliquable après chaque envoi. Répéter l'envoi d'une offre encore
 * en attente, aux mêmes conditions, ne doit rien changer : même `offered_at`, donc même clé de
 * notification, donc aucun second e-mail à l'atelier (revue Codex de #190, 8 novembre 2026).
 * Une rémunération ou une prestation modifiée est une nouvelle offre : nouvel horodatage, nouvel
 * e-mail.
 */
export interface ExistingWorkshopOffer {
  state: string | null;
  agreement_version: string | number | null;
  binder_payout_cents: number | null;
  service_description: string | null;
  offered_at: string | null;
}

export function reassignmentOfferTiming(
  existing: ExistingWorkshopOffer | null,
  terms: { payoutCents: number; serviceDescription: string },
  now: string,
): { offeredAt: string; rewrite: boolean } {
  const samePendingOffer =
    existing !== null &&
    !existing.agreement_version &&
    existing.state === "offered" &&
    existing.offered_at !== null &&
    existing.binder_payout_cents === terms.payoutCents &&
    (existing.service_description ?? "").trim() === terms.serviceDescription.trim();
  return samePendingOffer ? { offeredAt: existing!.offered_at!, rewrite: false } : { offeredAt: now, rewrite: true };
}
