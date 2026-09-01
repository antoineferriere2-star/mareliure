/**
 * Display helpers for a stored Dossier Commercial (Project Brief).
 *
 * Presentation only: nothing here changes what the engine computes or what is
 * stored. Two problems this module exists to solve, both visible in the portal:
 *
 * 1. Historical rows carry a *status sentence* in `build_dossiers.summary`
 *    ("Draft dossier — 2 follow-up items pending.", "Complete dossier ready
 *    for commercial review."). That is workflow state, not the visitor's
 *    project, so it must never be shown as the title of a brief. The status is
 *    already rendered as a status.
 * 2. Older briefs stored raw answer values ("ground_level", "not-sure",
 *    "compositeDecking") rather than the Playbook's label. They must read as
 *    labels, without rewriting stored data.
 */

/** Legacy workflow sentences that were written into `summary` — never a title. */
const STATUS_SUMMARY_PATTERNS: RegExp[] = [
  /^draft dossier\b/i,
  /^complete dossier ready\b/i,
  /^dossier (draft|ready)\b/i,
];

export function isStatusSummary(text: string | null | undefined): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  return STATUS_SUMMARY_PATTERNS.some((re) => re.test(trimmed));
}

const NOT_SURE_LABELS: Record<string, string> = {
  not_sure: "Not sure",
  "not-sure": "Not sure",
  notsure: "Not sure",
};

/**
 * Turns a raw stored value into something readable, and leaves anything that
 * already reads as a sentence untouched (a visitor's free text must survive
 * verbatim). Multi-value strings ("a, b") are humanized entry by entry.
 */
export function humanizeRawValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes(",")) {
    return trimmed
      .split(",")
      .map((part) => humanizeRawValue(part))
      .filter(Boolean)
      .join(", ");
  }
  // Already prose: contains a space or sentence punctuation.
  if (/[\s.:!?]/.test(trimmed) && !/^[a-z]+([_-][a-z0-9]+)+$/i.test(trimmed)) return trimmed;

  const lower = trimmed.toLowerCase();
  if (NOT_SURE_LABELS[lower]) return NOT_SURE_LABELS[lower];

  const isRawToken =
    /^[a-z0-9]+([_-][a-z0-9]+)+$/i.test(trimmed) || /^[a-z]+(?:[A-Z][a-z0-9]*)+$/.test(trimmed);
  if (!isRawToken) return trimmed;

  const words = trimmed
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return trimmed;
  return words[0].charAt(0).toUpperCase() + words[0].slice(1) + (words.length > 1 ? " " + words.slice(1).join(" ") : "");
}

export interface DossierTitleInput {
  /** `build_dossiers.summary` as stored — may be a legacy status sentence. */
  storedSummary?: string | null;
  /** `content.projectSummary` — the visitor's project, written by the Playbook. */
  projectSummary?: string | null;
  visitorName?: string | null;
  missionName?: string | null;
  id: string;
}

/**
 * What to show as the name of a brief. Always the visitor's project first,
 * never workflow state, and never an empty cell.
 */
export function resolveDossierTitle(input: DossierTitleInput): string {
  const project = input.projectSummary?.trim();
  if (project && !isStatusSummary(project)) return humanizeRawValue(project);

  const stored = input.storedSummary?.trim();
  if (stored && !isStatusSummary(stored)) return humanizeRawValue(stored);

  const parts = [input.visitorName?.trim(), input.missionName?.trim()].filter(
    (p): p is string => Boolean(p),
  );
  if (parts.length > 0) return `Project Brief — ${parts.join(" · ")}`;
  return `Project Brief ${input.id.slice(0, 8)}`;
}
