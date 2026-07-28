import type { BriefSectionKey } from "@/build/schema/playbook";

export const BRIEF_SECTION_LABELS: Record<BriefSectionKey, string> = {
  confirmedInformation: "Confirmed information",
  assumptionsAndCalculated: "Assumptions and calculations",
  constraints: "Constraints",
  missingInformation: "Missing information",
  budgetAndTiming: "Budget and timeline",
};

export const BRIEF_SECTION_KEYS = Object.keys(BRIEF_SECTION_LABELS) as BriefSectionKey[];
