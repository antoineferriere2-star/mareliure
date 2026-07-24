import type { BriefSectionKey } from "@/build/schema/playbook";

export const BRIEF_SECTION_LABELS: Record<BriefSectionKey, string> = {
  confirmedInformation: "Informations confirmées",
  assumptionsAndCalculated: "Hypothèses et calculs",
  constraints: "Contraintes",
  missingInformation: "Informations manquantes",
  budgetAndTiming: "Budget et délai",
};

export const BRIEF_SECTION_KEYS = Object.keys(BRIEF_SECTION_LABELS) as BriefSectionKey[];
