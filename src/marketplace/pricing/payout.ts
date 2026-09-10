/**
 * La rémunération proposée à l'atelier, déduite du prix Ma Reliure.
 *
 * Les ateliers ne chiffrent pas : Ma Reliure fixe le prix du projet, garde sa
 * marge, et propose le reste. La marge gardée est la plus grande de deux
 * règles administrables — une part du prix HT et un minimum en euros — pour
 * qu'un petit projet ne se traite pas à perte.
 *
 * Exemple : 400 € HT, marge cible 25 %, minimum 80 € → 100 € gardés, 300 €
 * proposés à l'atelier.
 *
 * La rémunération est arrondie à l'euro inférieur : la marge ne descend jamais
 * sous la règle pour quelques centimes. Ce n'est qu'une proposition — sur un
 * dossier, Ma Reliure peut la changer.
 */

export interface PayoutPolicy {
  /** La part du prix HT que Ma Reliure garde. */
  targetMarginBps: number;
  /** Le montant en dessous duquel Ma Reliure ne descend pas. */
  minimumMarginCents: number;
}

export const PAYOUT_ROUNDING_CENTS = 100;

/** Garde-fou de saisie : au-delà de 90 %, ce n'est plus une marge. */
export const MAX_TARGET_MARGIN_BPS = 9_000;

export interface PayoutProposal {
  payoutCents: number | null;
  /** Ce que Ma Reliure garde réellement, HT, après arrondi. */
  retainedMarginCents: number | null;
  problem: string | null;
}

export function proposeBinderPayout(priceHtCents: number, policy: PayoutPolicy): PayoutProposal {
  const target = Math.ceil((priceHtCents * policy.targetMarginBps) / 10_000);
  const margin = Math.max(target, policy.minimumMarginCents);
  const payout =
    Math.floor((priceHtCents - margin) / PAYOUT_ROUNDING_CENTS) * PAYOUT_ROUNDING_CENTS;
  if (payout <= 0)
    return {
      payoutCents: null,
      retainedMarginCents: null,
      problem: "Le prix HT ne couvre pas la marge minimale : aucune rémunération proposable.",
    };
  return { payoutCents: payout, retainedMarginCents: priceHtCents - payout, problem: null };
}

export function validatePayoutPolicy(policy: PayoutPolicy): string[] {
  const errors: string[] = [];
  if (
    !Number.isInteger(policy.targetMarginBps) ||
    policy.targetMarginBps < 0 ||
    policy.targetMarginBps > MAX_TARGET_MARGIN_BPS
  )
    errors.push("La marge cible doit être comprise entre 0 et 90 %.");
  if (!Number.isInteger(policy.minimumMarginCents) || policy.minimumMarginCents < 0)
    errors.push("La marge minimale doit être un montant positif ou nul.");
  return errors;
}
