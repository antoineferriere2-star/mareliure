export const MISSION_STATUSES = ["draft", "active", "paused", "archived"] as const;
export type MissionStatus = (typeof MISSION_STATUSES)[number];

export interface MissionPublicationState {
  status: MissionStatus;
  playbook_version_id: string | null;
  public_token: string | null;
  public_token_revoked_at: string | null;
  published_at: string | null;
}

export type MissionStatusPatch =
  | { ok: true; patch: Partial<MissionPublicationState> & { status: MissionStatus } }
  | { ok: false; error: string };

export function isMissionPubliclyAvailable(mission: MissionPublicationState): boolean {
  return (
    mission.status === "active" &&
    mission.playbook_version_id !== null &&
    mission.public_token !== null &&
    mission.public_token_revoked_at === null
  );
}

export function buildMissionStatusPatch(
  current: MissionPublicationState,
  targetStatus: MissionStatus,
  nowIso: string,
  newToken: () => string,
): MissionStatusPatch {
  if (targetStatus !== "active") return { ok: true, patch: { status: targetStatus } };

  if (!current.playbook_version_id) {
    return { ok: false, error: "Cannot activate a Mission without a published Playbook version." };
  }

  const shouldIssueToken = !current.public_token || current.public_token_revoked_at !== null;
  return {
    ok: true,
    patch: {
      status: "active",
      public_token: shouldIssueToken ? newToken() : current.public_token,
      public_token_revoked_at: null,
      published_at: current.published_at ?? nowIso,
    },
  };
}

export function canDeleteMission(input: {
  status: MissionStatus;
  dossierCount: number;
  sessionCount: number;
}): { ok: true } | { ok: false; error: string } {
  if (input.status === "active") {
    return { ok: false, error: "Unpublish this Mission before deleting it." };
  }
  if (input.dossierCount > 0 || input.sessionCount > 0) {
    return {
      ok: false,
      error: "This Mission already has visitor sessions or Project Briefs. Archive it instead.",
    };
  }
  return { ok: true };
}

export function duplicatePlaybookName(name: string): string {
  const trimmed = name.trim();
  const base = trimmed.length > 0 ? trimmed : "Untitled Playbook";
  const copy = `Copy of ${base}`;
  return copy.length <= 200 ? copy : copy.slice(0, 200);
}
