// Pure transform from the internal, commercial ProjectBrief into the
// visitor-facing VisitorProjectSummary. Sits beside brief.ts's own
// generateProjectBrief (same "engine/" convention: schema in -> schema out,
// no I/O, no i18n copy strings — those belong to the view layer that calls
// this). Never used as a public DTO substitute for ProjectBrief itself.
import type { BriefLine, ProjectBrief } from "@/build/schema/brief";
import { NEEDS_VERIFICATION_SOURCES, allBriefLines } from "@/build/schema/briefLabels";
import type { MissionProposal } from "@/build/schema/missionProposal";
import type { SupportedLocale } from "@/build/i18n/locales";
import type { MeasurementSystem } from "@/build/measurements/types";
import {
  VISITOR_SUMMARY_VERSION,
  type SummaryItem,
  type VisitorPhotoReference,
  type VisitorProjectSummary,
} from "@/build/schema/visitorSummary";

function toItem(line: BriefLine): SummaryItem {
  return { label: line.label, value: line.value };
}

function lineKey(line: BriefLine): string {
  return `${line.label}|${line.value}`;
}

export interface BuildVisitorProjectSummaryOptions {
  businessName: string;
  locale: SupportedLocale;
  measurementSystem: MeasurementSystem;
  photos?: VisitorPhotoReference[];
  submittedAt: string;
}

/**
 * Deliberately excludes brief.confidence and brief.suggestedNextAction in
 * full — both are commercial-only signals never meant for the visitor. Every
 * other line is regrouped by its own source into confirmed/calculated/
 * itemsToConfirm, mirroring briefLabels.ts's computeItemsToVerify so "still
 * to confirm" here means exactly what the internal item-to-verify count
 * already means elsewhere in the app — never a second, drifting definition.
 */
export function buildVisitorProjectSummary(
  brief: ProjectBrief,
  proposal: MissionProposal,
  options: BuildVisitorProjectSummaryOptions,
): VisitorProjectSummary {
  const needsVerification = new Set<string>();
  for (const line of brief.missingInformation) needsVerification.add(lineKey(line));
  for (const line of allBriefLines(brief)) {
    if (NEEDS_VERIFICATION_SOURCES.includes(line.source)) needsVerification.add(lineKey(line));
  }

  const itemsToConfirm: SummaryItem[] = [];
  const seenToConfirm = new Set<string>();
  for (const line of [...brief.missingInformation, ...allBriefLines(brief)]) {
    const key = lineKey(line);
    if (!needsVerification.has(key) || seenToConfirm.has(key)) continue;
    seenToConfirm.add(key);
    itemsToConfirm.push(toItem(line));
  }

  // confirmedInformation/assumptionsAndCalculated/constraints are pooled and
  // re-split by each line's own source, so a constraint line (e.g. "Access
  // limitations") lands in the same visitor-facing bucket a confirmed answer
  // or a calculated value would — the "constraints" grouping itself is an
  // internal ProjectBrief category, not a distinct visitor-facing bucket.
  const pooled = [
    ...brief.confirmedInformation,
    ...brief.assumptionsAndCalculated,
    ...brief.constraints,
  ];

  const confirmedItems = pooled
    .filter((line) => line.source === "visitor_answer" && !needsVerification.has(lineKey(line)))
    .map(toItem);

  const calculatedItems = pooled
    .filter(
      (line) =>
        (line.source === "calculated_value" || line.source === "deterministic_rule") &&
        !needsVerification.has(lineKey(line)),
    )
    .map(toItem);

  const budgetAndTimingItems = brief.budgetAndTiming
    .filter((line) => !needsVerification.has(lineKey(line)))
    .map(toItem);

  return {
    version: VISITOR_SUMMARY_VERSION,
    locale: options.locale,
    measurementSystem: options.measurementSystem,
    businessName: options.businessName,
    summary: brief.projectSummary,
    confirmedItems,
    calculatedItems,
    itemsToConfirm,
    budgetAndTimingItems,
    photos: options.photos ?? [],
    confirmationText: proposal.confirmationText?.trim() || null,
    submittedAt: options.submittedAt,
  };
}
