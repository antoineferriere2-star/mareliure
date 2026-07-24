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
  | "assumed_default";

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
  confirmedInformation: BriefLine[];
  assumptionsAndCalculated: BriefLine[];
  constraints: BriefLine[];
  missingInformation: BriefLine[];
  budgetAndTiming: BriefLine[];
  confidence: ProjectBriefConfidence;
  suggestedNextAction: BriefLine;
}
