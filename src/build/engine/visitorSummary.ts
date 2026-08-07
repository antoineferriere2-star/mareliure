// Pure transform from the internal, commercial ProjectBrief into the
// visitor-facing VisitorProjectSummary. Sits beside brief.ts's own
// generateProjectBrief (same "engine/" convention: schema in -> schema out,
// no I/O), with one deliberate exception: this is the fork point between the
// internal ProjectBrief (English, stored as build_dossiers.content for the
// commercial team regardless of the visitor's locale — generateProjectBrief
// itself MUST stay untranslated, or a Spanish visitor's submission would
// corrupt the English-speaking team's Dossier) and the visitor-facing DTO,
// which is frozen once at submit time and later read by both the web view
// and the confirmation email. Translating labels/values here, once, keeps
// both consumers correctly localized without duplicating the lookup in each
// view. Only whole-string dictionary matches translate — a visitor's own
// free text, or a value with a per-submission number baked in, simply falls
// through unchanged (see publicCopy).
import type { BriefLine, ProjectBrief } from "@/build/schema/brief";
import { NEEDS_VERIFICATION_SOURCES, allBriefLines } from "@/build/schema/briefLabels";
import type { MissionProposal } from "@/build/schema/missionProposal";
import type { Answers } from "@/build/schema/answers";
import type { SupportedLocale } from "@/build/i18n/locales";
import type { MeasurementSystem } from "@/build/measurements/types";
import { PROJECT_PHOTOS_BUCKET } from "@/build/storage/projectPhotosBucket";
import { publicCopy } from "@/build/pages/public/publicLocaleContext";
import {
  VISITOR_SUMMARY_VERSION,
  type SummaryItem,
  type VisitorPhotoReference,
  type VisitorProjectSummary,
} from "@/build/schema/visitorSummary";
import type { DeckPreviewSnapshot } from "@/build/visualPreview/deckPreviewParams";

/**
 * Every answer that points at a real file in Storage, from either source: the
 * single InspirationPhotoAnswer the vision agent reads, and the entries of a
 * `photo` field whose Playbook stores uploads rather than filenames. Entries
 * without a storagePath are skipped — a `filename_only` field records the name
 * of a file that was never sent anywhere, so there is nothing to show.
 *
 * Generic across Playbooks: scans every answer value rather than assuming a
 * specific field key.
 */
export function extractPhotoReferences(answers: Answers): VisitorPhotoReference[] {
  const refs: VisitorPhotoReference[] = [];
  for (const value of Object.values(answers)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (
          entry &&
          typeof entry === "object" &&
          typeof (entry as { storagePath?: unknown }).storagePath === "string"
        ) {
          const photo = entry as { storagePath: string; filename?: string };
          refs.push({
            path: photo.storagePath,
            caption: photo.filename,
            bucket: PROJECT_PHOTOS_BUCKET,
          });
        }
      }
      continue;
    }
    if (
      value &&
      typeof value === "object" &&
      "photoPath" in value &&
      typeof (value as { photoPath: unknown }).photoPath === "string"
    ) {
      // No bucket: the inspiration bucket is the historical default, and
      // every snapshot already stored relies on that reading.
      refs.push({ path: (value as { photoPath: string }).photoPath });
    }
  }
  return refs;
}

function toItem(line: BriefLine, translate: (text: string) => string): SummaryItem {
  return { label: translate(line.label), value: translate(line.value) };
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
  /** Already resolved by the caller (build-runtime.ts, which alone has the Playbook schema + raw answers) — this module stays a pure brief->summary transform and never computes the resolution itself. */
  visualPreview?: DeckPreviewSnapshot;
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
  const translate = (text: string) => publicCopy(options.locale, text);
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
    itemsToConfirm.push(toItem(line, translate));
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
    .map((line) => toItem(line, translate));

  const calculatedItems = pooled
    .filter(
      (line) =>
        (line.source === "calculated_value" || line.source === "deterministic_rule") &&
        !needsVerification.has(lineKey(line)),
    )
    .map((line) => toItem(line, translate));

  const budgetAndTimingItems = brief.budgetAndTiming
    .filter((line) => !needsVerification.has(lineKey(line)))
    .map((line) => toItem(line, translate));

  return {
    version: VISITOR_SUMMARY_VERSION,
    locale: options.locale,
    measurementSystem: options.measurementSystem,
    businessName: options.businessName,
    summary: translate(brief.projectSummary),
    confirmedItems,
    calculatedItems,
    itemsToConfirm,
    budgetAndTimingItems,
    photos: options.photos ?? [],
    confirmationText: proposal.confirmationText?.trim() || null,
    submittedAt: options.submittedAt,
    ...(options.visualPreview ? { visualPreview: options.visualPreview } : {}),
  };
}
