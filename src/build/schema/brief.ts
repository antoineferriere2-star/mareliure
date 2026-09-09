/**
 * Generic Project Brief (Dossier Commercial) output shape, produced by
 * `src/build/engine/brief.ts` from a PlaybookSchema + Answers. Every line
 * carries its own provenance so a reviewer can tell an actual visitor answer
 * from a calculated value or a playbook-authored assumption.
 */

export type BriefLineSource =
  | "visitor_answer"
  | "calculated_value"
  | "deterministic_rule"
  | "assumed_default"
  /** Proposed by the vision AI agent from an inspiration photo, not yet confirmed by the visitor — always a hypothesis, never presented as fact. */
  | "image_hypothesis";

export interface BriefLine {
  label: string;
  value: string;
  source: BriefLineSource;
  fieldKey?: string;
  category?: string;
}

export type ConfidenceLabel = "low" | "medium" | "high";

export interface ProjectBriefConfidence {
  score: number;
  label: ConfidenceLabel;
  reasons: string[];
}

export interface ProjectBrief {
  generatedAt: string;
  missionName: string;
  status: string;
  projectSummary: string;
  /**
   * Le résumé morceau par morceau, chacun avec les clés de réponse qu'il a
   * interpolées. Permet à un consommateur de retirer une phrase qui cite une
   * réponse qu'il n'a pas le droit de montrer à son audience.
   *
   * Optionnel : les Dossiers générés avant cette capacité n'en ont pas, et ils
   * sont stockés tels quels en base. Un consommateur retombe sur
   * `projectSummary`.
   */
  projectSummaryParts?: { text: string; fieldKeys: string[] }[];
  confirmedInformation: BriefLine[];
  assumptionsAndCalculated: BriefLine[];
  constraints: BriefLine[];
  missingInformation: BriefLine[];
  budgetAndTiming: BriefLine[];
  confidence: ProjectBriefConfidence;
  suggestedNextAction: BriefLine;
}
