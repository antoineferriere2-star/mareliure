/**
 * Triage: what the marketplace makes of a Dossier the engine has just
 * produced.
 *
 * The split matters. The Playbook states facts ("valeur estimée à plus de
 * 1 000 €", "ouvrage patrimonial") because a trade expert wrote them. This
 * module decides what the *business* does about them — hold the case for a
 * human before any relieur sees it. Teaching the engine the 1 000 € rule would
 * have made a generic qualification engine carry one marketplace's commercial
 * policy.
 *
 * Pure: profile in, flags out. No I/O, no database, no clock.
 */
import { CASE_ANSWER_VALUES, type CaseProfile } from "./caseProfile";

export interface CaseTriage {
  /** No relieur is invited until a human has looked at it. */
  manualReviewRequired: boolean;
  /** The book itself needs specialist assessment before any work is discussed (§24). */
  heritageFlag: boolean;
  /** Copied through for display and filtering; null when the visitor did not know. */
  declaredValueBand: string | null;
  /** Why, in the words the admin will read on the case. Empty when nothing was flagged. */
  reasons: string[];
}

export function triageCase(profile: CaseProfile): CaseTriage {
  const reasons: string[] = [];
  const V = CASE_ANSWER_VALUES;

  const valuable = profile.declaredValue === V.declaredValue.over1000;
  if (valuable) {
    reasons.push("Valeur déclarée supérieure à 1 000 €.");
  }
  if (profile.heritage) {
    reasons.push(
      "Ouvrage patrimonial : une validation par un professionnel est nécessaire avant prise en charge.",
    );
  }
  if (profile.mouldSuspected) {
    reasons.push(
      "Suspicion de moisissure : à confirmer avant tout transport, et à réserver aux ateliers équipés.",
    );
  }

  return {
    manualReviewRequired: reasons.length > 0,
    heritageFlag: profile.heritage,
    declaredValueBand: profile.declaredValue,
    reasons,
  };
}
