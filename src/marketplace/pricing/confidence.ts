/**
 * Ce que vaut une suggestion de prix.
 *
 * L'ancien moteur calculait sa confiance en comptant les réponses du visiteur.
 * « Haute » y voulait dire « le visiteur a bien rempli le parcours » — pas
 * « nous savons ce que ce travail coûte ». Un projet parfaitement décrit dont
 * aucun tarif n'était connu ressortait en confiance haute, et c'est exactement
 * là qu'un prix inventé devient dangereux : bien présenté, on le valide.
 *
 * La confiance porte maintenant sur ce qui la fonde réellement — combien
 * d'ateliers ont parlé, quand, à quel point ils sont d'accord, et si le
 * travail demandé est bien celui qu'ils ont tarifé. Ce que le visiteur a
 * répondu reste un facteur, mais un facteur parmi d'autres, et jamais celui
 * qui suffit.
 *
 * `manual_review` n'est pas le bas de l'échelle : c'est un refus de chiffrer.
 * Le moteur ne dégrade pas sa réponse, il s'abstient.
 */
import { requiresStudy } from "./catalog";
import type { RateAggregate } from "./rateCard";

export const PRICING_CONFIDENCES = ["manual_review", "low", "medium", "high"] as const;
export type PricingConfidence = (typeof PRICING_CONFIDENCES)[number];

export const CONFIDENCE_LABELS: Record<PricingConfidence, string> = {
  manual_review: "Revue manuelle",
  low: "Faible",
  medium: "Moyenne",
  high: "Haute",
};

/** Au-delà, une donnée tarifaire a vieilli : les matières et les heures bougent. */
export const STALE_AFTER_DAYS = 540;

/** Écart max/min au-delà duquel les ateliers ne disent pas la même chose. */
export const HIGH_DISPERSION_BPS = 8_000;

export interface ConfidenceInput {
  /** Les agrégats retenus, un par travail identifié. */
  aggregates: readonly RateAggregate[];
  /** Travaux identifiés pour lesquels aucun tarif n'existe. */
  uncoveredWorkItemKeys: readonly string[];
  /** Tous les travaux identifiés, y compris ceux sur étude. */
  workItemKeys: readonly string[];
  /** Réponses structurées manquantes qui pèsent sur le chiffrage. */
  missingAnswers: readonly string[];
  /** Ouvrage ancien, rare, manuscrit : la valeur patrimoniale change la donne. */
  heritage: boolean;
  now?: Date;
}

export interface ConfidenceAssessment {
  confidence: PricingConfidence;
  /** Le plus petit nombre d'ateliers sur lequel repose un des travaux. */
  referenceCount: number;
  /** Ce qui a fait pencher la note, en français, pour l'administration. */
  factors: string[];
}

function daysSince(iso: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
}

export function assessConfidence(input: ConfidenceInput): ConfidenceAssessment {
  const now = input.now ?? new Date();
  const factors: string[] = [];

  // Trois motifs d'abstention. Aucun n'est rattrapable par une bonne note
  // ailleurs : on ne compense pas un travail non tarifé par un autre bien
  // connu.
  if (requiresStudy(input.workItemKeys)) {
    factors.push("Le projet comporte un travail qui se chiffre sur étude.");
    return { confidence: "manual_review", referenceCount: 0, factors };
  }
  if (input.workItemKeys.length === 0) {
    factors.push("Aucun travail n'a pu être identifié à partir du projet.");
    return { confidence: "manual_review", referenceCount: 0, factors };
  }
  if (input.uncoveredWorkItemKeys.length > 0) {
    factors.push(
      `Aucun tarif de référence pour ${input.uncoveredWorkItemKeys.length} travail(aux) identifié(s).`,
    );
    return { confidence: "manual_review", referenceCount: 0, factors };
  }

  const referenceCount = Math.min(...input.aggregates.map((a) => a.referenceCount));
  const oldestDays = Math.max(
    ...input.aggregates.map((a) => daysSince(a.oldestEffectiveFrom, now)),
  );
  const worstDispersion = Math.max(...input.aggregates.map((a) => a.dispersionBps));

  if (input.heritage) {
    factors.push("Ouvrage ancien, rare ou manuscrit : la valeur patrimoniale demande un regard.");
    return { confidence: "manual_review", referenceCount, factors };
  }

  // À partir d'ici on chiffre. La note part du nombre d'ateliers, puis
  // descend : rien ne la fait remonter.
  let confidence: PricingConfidence =
    referenceCount >= 6 ? "high" : referenceCount >= 3 ? "medium" : "low";
  factors.push(
    referenceCount === 1
      ? "Un seul atelier de référence : validation artisan recommandée."
      : `${referenceCount} ateliers de référence sur le travail le moins couvert.`,
  );

  if (oldestDays > STALE_AFTER_DAYS) {
    confidence = confidence === "high" ? "medium" : "low";
    factors.push(`Donnée la plus ancienne : ${Math.floor(oldestDays / 30)} mois.`);
  }
  if (worstDispersion > HIGH_DISPERSION_BPS) {
    confidence = confidence === "high" ? "medium" : "low";
    factors.push("Les ateliers sont très dispersés sur au moins un travail.");
  }
  if (input.missingAnswers.length > 0) {
    confidence = confidence === "high" ? "medium" : confidence;
    factors.push(`Informations manquantes : ${input.missingAnswers.join(", ")}.`);
  }

  return { confidence, referenceCount, factors };
}
