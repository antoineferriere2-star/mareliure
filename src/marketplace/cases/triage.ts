/**
 * Triage: what the marketplace makes of a Dossier the engine has just
 * produced.
 *
 * The split matters. The Playbook states facts ("valeur estimée à plus de
 * 1 000 €", "ouvrage patrimonial") because a trade expert wrote them. This
 * module decides what the *business* does about them — hold the case for a
 * human before any relieur sees it. Teaching the engine the 1 000 € rule would
 * have made a generic qualification engine carry one marketplace's commercial
 * policy.
 *
 * **It never reads a Project Brief.** The Brief is a document written for a
 * person: its labels and values are French sentences chosen to be read, and
 * they get reworded. Parsing them would mean a copy edit in a Playbook could
 * silently switch off manual review on thousand-euro books. Triage takes a
 * `CaseProfile`, built in `caseProfile.ts` from the stable machine values in
 * `build_runtime_sessions.answers`, and nothing else. `triageContract.test.ts`
 * holds that line: it rewrites every human-readable string in the Playbook and
 * asserts the triage output is byte-for-byte identical.
 *
 * Pure: profile in, flags out. No I/O, no database, no clock.
 */
import type { CaseProfile } from "./caseProfile";

/**
 * Stable codes, not sentences. These are what gets stored in
 * `marketplace_cases.triage_flags` and what any query, report or later
 * automation matches on; the French wording lives in `TRIAGE_FLAG_MESSAGES`
 * below and is free to change without touching a single stored row.
 *
 * The previous shape stored the French sentences themselves in `admin_notes`,
 * joined by newlines, and the back-office split them apart again — text used
 * as an API, and squatting a column meant for what a human writes.
 */
export const TRIAGE_FLAGS = [
  "declared_value_over_1000",
  "heritage_book",
  "suspected_mould",
] as const;
export type TriageFlag = (typeof TRIAGE_FLAGS)[number];

/** For display only. Nothing branches on these strings. */
export const TRIAGE_FLAG_MESSAGES: Record<TriageFlag, string> = {
  declared_value_over_1000: "Valeur déclarée supérieure à 1 000 €.",
  heritage_book:
    "Ouvrage patrimonial : une validation par un professionnel est nécessaire avant prise en charge.",
  suspected_mould:
    "Suspicion de moisissure : à confirmer avant tout transport, et à réserver aux ateliers équipés.",
};

export function isTriageFlag(value: unknown): value is TriageFlag {
  return typeof value === "string" && (TRIAGE_FLAGS as readonly string[]).includes(value);
}

export interface CaseTriage {
  /** No relieur is invited until a human has looked at it. */
  manualReviewRequired: boolean;
  /** The book itself needs specialist assessment before any work is discussed (§24). */
  heritageFlag: boolean;
  /** The marketplace's own band, already canonical when it reaches here. */
  declaredValueBand: CaseProfile["declaredValueBand"];
  /** Why, as codes. Empty when nothing was flagged. */
  flags: TriageFlag[];
}

export function triageCase(profile: CaseProfile): CaseTriage {
  const flags: TriageFlag[] = [];

  if (profile.declaredValueBand === "over_1000") flags.push("declared_value_over_1000");
  if (profile.heritage) flags.push("heritage_book");
  if (profile.mouldSuspected) flags.push("suspected_mould");

  return {
    manualReviewRequired: flags.length > 0,
    heritageFlag: profile.heritage,
    declaredValueBand: profile.declaredValueBand,
    flags,
  };
}

/** The sentences an admin reads, derived from the codes at display time. */
export function triageMessages(flags: readonly string[]): string[] {
  return flags.filter(isTriageFlag).map((flag) => TRIAGE_FLAG_MESSAGES[flag]);
}
