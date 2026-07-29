// Visitor-facing Project Summary — a distinct, deliberately smaller view of
// the same submission a Project Brief already describes. Never the
// commercial DTO itself: built by engine/visitorSummary.ts's
// buildVisitorProjectSummary, which drops ProjectBrief.confidence and
// .suggestedNextAction entirely (both commercial-only) and regroups every
// other line into the three buckets a visitor can make sense of, without
// exposing the raw BriefLineSource enum.
import type { SupportedLocale } from "@/build/i18n/locales";
import type { MeasurementSystem } from "@/build/measurements/types";
import type { DeckPreviewSnapshot } from "@/build/visualPreview/deckPreviewParams";

export interface SummaryItem {
  label: string;
  value: string;
}

/** Storage path only, never a signed URL — URLs are resolved fresh at display time (they expire), never frozen into this snapshot. Server-side only: never sent as-is to a browser (see DisplayPhotoReference). */
export interface VisitorPhotoReference {
  path: string;
  caption?: string;
}

/**
 * What the view layer actually needs from a photo. Deliberately does not
 * require `path` — the live post-submission response and the secure
 * /project-summary link expose different shapes (the latter strips `path`
 * and `bucket` entirely, exposing only a resolved signed `url`), and the
 * shared VisitorProjectSummaryView only ever needs a count, never the path.
 */
export interface DisplayPhotoReference {
  path?: string;
  url?: string | null;
  caption?: string;
}

export const VISITOR_SUMMARY_VERSION = 1;

export interface VisitorProjectSummary {
  version: number;
  locale: SupportedLocale;
  measurementSystem: MeasurementSystem;
  businessName: string;
  summary: string;
  confirmedItems: SummaryItem[];
  calculatedItems: SummaryItem[];
  itemsToConfirm: SummaryItem[];
  budgetAndTimingItems: SummaryItem[];
  photos: VisitorPhotoReference[];
  /** proposal.confirmationText, verbatim, or null when the workspace never configured one — the view layer supplies the localized generic fallback, never this module. */
  confirmationText: string | null;
  submittedAt: string;
  /** Only present when the Mission's Playbook enabled the visual-preview capability at submit time — absent (not null) for every Mission that predates or never opted into this feature, so old snapshots stay byte-for-byte compatible. Frozen at submission; never recomputed from a later Playbook edit. */
  visualPreview?: DeckPreviewSnapshot;
}
