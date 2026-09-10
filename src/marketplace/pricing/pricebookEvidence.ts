/**
 * Sur quoi repose un prix — dit en mots, jamais en note.
 *
 * Un score de confiance « 72/100 » aurait l'air précis et ne voudrait rien
 * dire : personne ne sait ce qui sépare 72 de 68. Ici, un niveau nomme ce qui
 * existe réellement — aucune donnée, des prix affichés sur le web, un ou deux
 * ateliers, trois à cinq, six ou plus — et des alertes disent ce qui a vieilli
 * ou décroché. On lit la phrase, on sait quoi faire.
 *
 * Le benchmark web ne fait jamais monter le niveau au-dessus de « web
 * seulement » : un prix affiché n'a été confirmé par personne.
 */
import { BENCHMARK_STALE_AFTER_DAYS } from "./benchmark";
import { STALE_AFTER_DAYS } from "./confidence";

export const EVIDENCE_LEVELS = [
  "NONE",
  "WEB_ONLY",
  "BINDERS_FEW",
  "BINDERS_SEVERAL",
  "BINDERS_MANY",
] as const;

export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

export const EVIDENCE_LABELS: Record<EvidenceLevel, string> = {
  NONE: "Aucune donnée",
  WEB_ONLY: "Benchmark web seulement",
  BINDERS_FEW: "1 à 2 ateliers",
  BINDERS_SEVERAL: "3 à 5 ateliers",
  BINDERS_MANY: "6 ateliers ou plus",
};

/** Un prix publié se relit au moins une fois par an. */
export const PRICEBOOK_REVIEW_AFTER_DAYS = 365;

export interface EvidenceInput {
  /** Ateliers distincts dont la grille fait référence (vérifiée ou payée). */
  binderReferenceCount: number;
  binderOldestEffectiveFrom: string | null;
  benchmarkSourceCount: number;
  benchmarkOldestObservedAt: string | null;
  pricebookValidatedAt: string | null;
  driftSeverity: "watch" | "act" | null;
  now?: Date;
}

export interface EvidenceAssessment {
  level: EvidenceLevel;
  label: string;
  alerts: string[];
}

function daysSince(iso: string, now: Date): number {
  const normalized = iso.length === 10 ? `${iso}T00:00:00Z` : iso;
  return Math.floor((now.getTime() - new Date(normalized).getTime()) / 86_400_000);
}

const months = (days: number) => Math.floor(days / 30);

export function assessEvidence(input: EvidenceInput): EvidenceAssessment {
  const now = input.now ?? new Date();
  const refs = input.binderReferenceCount;
  const level: EvidenceLevel =
    refs >= 6
      ? "BINDERS_MANY"
      : refs >= 3
        ? "BINDERS_SEVERAL"
        : refs >= 1
          ? "BINDERS_FEW"
          : input.benchmarkSourceCount > 0
            ? "WEB_ONLY"
            : "NONE";

  const alerts: string[] = [];
  if (level === "WEB_ONLY")
    alerts.push("Aucun atelier n'a confirmé ce niveau de prix : seulement des prix affichés.");
  if (level === "NONE" && input.pricebookValidatedAt)
    alerts.push("Prix publié sans aucune donnée de référence.");
  if (level === "BINDERS_FEW")
    alerts.push("Moins de trois ateliers : pas encore un ordre de grandeur du métier.");

  if (input.binderOldestEffectiveFrom) {
    const age = daysSince(input.binderOldestEffectiveFrom, now);
    if (age > STALE_AFTER_DAYS)
      alerts.push(`Grille d'atelier la plus ancienne : ${months(age)} mois.`);
  }
  if (input.benchmarkOldestObservedAt) {
    const age = daysSince(input.benchmarkOldestObservedAt, now);
    if (age > BENCHMARK_STALE_AFTER_DAYS)
      alerts.push(`Benchmark relevé il y a ${months(age)} mois.`);
  }
  if (input.pricebookValidatedAt) {
    const age = daysSince(input.pricebookValidatedAt, now);
    if (age > PRICEBOOK_REVIEW_AFTER_DAYS)
      alerts.push(`Prix validé il y a ${months(age)} mois : à relire.`);
  }
  if (input.driftSeverity === "act")
    alerts.push("Les ateliers se sont écartés de plus de 20 % de notre référence.");
  else if (input.driftSeverity === "watch")
    alerts.push("Les ateliers se sont écartés de plus de 10 % de notre référence.");

  return { level, label: EVIDENCE_LABELS[level], alerts };
}

/** Un ensemble ne repose jamais sur plus que son maillon le plus faible. */
export function weakestEvidence(assessments: readonly EvidenceAssessment[]): EvidenceAssessment {
  if (assessments.length === 0) return { level: "NONE", label: EVIDENCE_LABELS.NONE, alerts: [] };
  const rank = (level: EvidenceLevel) => EVIDENCE_LEVELS.indexOf(level);
  const weakest = assessments.reduce((worst, current) =>
    rank(current.level) < rank(worst.level) ? current : worst,
  );
  return {
    level: weakest.level,
    label: weakest.label,
    alerts: [...new Set(assessments.flatMap((assessment) => assessment.alerts))],
  };
}
