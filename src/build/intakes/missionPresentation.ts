/**
 * Turns a Mission row into what a workspace owner should actually see.
 *
 * The portal used to render `build_missions.playbook_name` raw, next to a
 * separate Status column. For a self-service workspace that produced the
 * contradiction "Deck intake — draft v1" sitting beside the badge "Active".
 *
 * The cause is that three different facts were collapsed into one string when
 * the draft was generated (portalOnboarding.data.functions.ts):
 *   - identity        "Deck intake"   — stable, belongs in the name
 *   - lifecycle       "draft"         — true only at generation time
 *   - a counter       "v1"            — `build_workspace_onboarding.draft_version`,
 *                                       i.e. how many times the AI re-drafted,
 *                                       NOT `build_playbook_versions.version_number`
 *
 * The generator now writes the identity alone, but rows created before that
 * keep the old string. These helpers therefore separate the three again at
 * render time, so historical rows read correctly without rewriting stored
 * data to hide the problem. Mission `status` was always correct — this is a
 * presentation fix, not a lifecycle one.
 */

export type MissionLifecycle = "active" | "paused" | "draft" | "archived";

export interface MissionStatusInput {
  /** `build_missions.status`: 'draft' | 'active' | 'paused' | 'archived'. */
  status: string | null | undefined;
  /** `build_missions.published_at` — set once, when the Mission first went live. */
  publishedAt?: string | null;
}

export interface MissionStatusPresentation {
  label: string;
  lifecycle: MissionLifecycle;
}

const LIFECYCLE_LABELS: Record<MissionLifecycle, string> = {
  active: "Active",
  paused: "Paused",
  draft: "Draft",
  archived: "Archived",
};

/**
 * The Mission's own `status` is authoritative — never the Playbook's name or
 * the version's technical state. A Mission that is live must read "Active"
 * even when it was published from a version still flagged as a draft
 * internally.
 */
export function missionStatusPresentation(input: MissionStatusInput): MissionStatusPresentation {
  const status = (input.status ?? "").trim().toLowerCase();

  if (status === "active" || status === "paused" || status === "draft" || status === "archived") {
    return { label: LIFECYCLE_LABELS[status], lifecycle: status };
  }

  // Older or hand-made rows with a missing/unrecognised status: fall back to
  // the one fact that is unambiguous — whether it was ever published.
  return input.publishedAt
    ? { label: LIFECYCLE_LABELS.active, lifecycle: "active" }
    : { label: LIFECYCLE_LABELS.draft, lifecycle: "draft" };
}

/**
 * Legacy suffix baked in by the draft generator: " — draft v3", "- draft v12",
 * or just "draft v1". Anchored to the end so a Playbook legitimately named
 * "Draft review intake" keeps its name.
 */
const LEGACY_DRAFT_SUFFIX = /\s*(?:[—–-]\s*)?draft\s+v\d+\s*$/i;

/**
 * The Playbook's identity, with the lifecycle noise stripped. The stored value
 * is left untouched; only the rendering changes, and the real state is shown
 * separately by missionStatusPresentation.
 */
export function playbookDisplayName(rawName: string | null | undefined): string | null {
  const name = (rawName ?? "").replace(/\s+/g, " ").trim();
  if (!name) return null;

  const cleaned = name.replace(LEGACY_DRAFT_SUFFIX, "").trim();
  // A name that was *only* the legacy suffix leaves nothing meaningful behind.
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * "v3" from the published version number — the real one, off
 * `build_playbook_versions.version_number`. Null when the Mission is not
 * pinned to a published version, so the caller can omit it rather than
 * inventing a "v1".
 */
export function playbookVersionLabel(versionNumber: number | null | undefined): string | null {
  return typeof versionNumber === "number" && Number.isFinite(versionNumber) && versionNumber > 0
    ? `v${versionNumber}`
    : null;
}

/** "Deck intake · v3", or just the name when no published version is known. */
export function playbookSummaryLabel(
  rawName: string | null | undefined,
  versionNumber: number | null | undefined,
): string {
  const name = playbookDisplayName(rawName);
  const version = playbookVersionLabel(versionNumber);
  if (!name) return version ?? "—";
  return version ? `${name} · ${version}` : name;
}
