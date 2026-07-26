// Public-facing display helpers for ProjectBrief — kept separate from
// brief.ts (pure schema) and engine/brief.ts (score/line generation) since
// these are presentation-only and must never change what the engine
// computes or the shape of ProjectBrief itself. Shared by every surface
// that renders a Brief to a visitor or a marketing page (BriefPreview.tsx),
// which is also the real post-submission screen for /m/:publicToken and
// /demo/deck-project — never just marketing copy.
import type { BriefLine, BriefLineSource, ProjectBrief } from "./brief";

/** Never render a raw BriefLineSource value — always go through this map. */
export const BRIEF_SOURCE_LABELS: Record<BriefLineSource, string> = {
  visitor_answer: "Customer provided",
  calculated_value: "Calculated",
  deterministic_rule: "Business rule",
  assumed_default: "Needs verification",
  image_hypothesis: "Image-based observation",
};

/**
 * Share of the intake that's confirmed vs. still missing. Derived purely
 * from existing ProjectBrief fields — never added to the schema itself.
 */
export function computeCompletionPercent(brief: ProjectBrief): number {
  const confirmed = brief.confirmedInformation.length;
  const missing = brief.missingInformation.length;
  const total = confirmed + missing;
  if (total === 0) return 100;
  return Math.round((confirmed / total) * 100);
}

const NEEDS_VERIFICATION_SOURCES: BriefLineSource[] = ["assumed_default", "image_hypothesis"];

function allBriefLines(brief: ProjectBrief): BriefLine[] {
  return [
    ...brief.confirmedInformation,
    ...brief.assumptionsAndCalculated,
    ...brief.constraints,
    ...brief.missingInformation,
    ...brief.budgetAndTiming,
  ];
}

/**
 * Missing information, plus any line elsewhere in the brief that's an
 * unconfirmed hypothesis or assumption — deduplicated by label+value so a
 * line counted once in missingInformation is never counted twice.
 */
export function computeItemsToVerify(brief: ProjectBrief): number {
  const seen = new Set<string>();
  for (const line of brief.missingInformation) seen.add(`${line.label}|${line.value}`);
  for (const line of allBriefLines(brief)) {
    if (NEEDS_VERIFICATION_SOURCES.includes(line.source)) seen.add(`${line.label}|${line.value}`);
  }
  return seen.size;
}
