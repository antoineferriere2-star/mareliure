import { describe, expect, it } from "vitest";
import {
  buildMissionStatusPatch,
  canDeleteMission,
  duplicatePlaybookName,
  isMissionPubliclyAvailable,
  type MissionPublicationState,
} from "./intakeLifecycle";

const baseMission: MissionPublicationState = {
  status: "paused",
  playbook_version_id: "version-1",
  public_token: "token-1",
  public_token_revoked_at: null,
  published_at: "2026-07-27T10:00:00.000Z",
};

describe("isMissionPubliclyAvailable", () => {
  it("requires an active Mission, a pinned version, an unrevoked token", () => {
    expect(isMissionPubliclyAvailable({ ...baseMission, status: "active" })).toBe(true);
    expect(isMissionPubliclyAvailable({ ...baseMission, status: "paused" })).toBe(false);
    expect(
      isMissionPubliclyAvailable({
        ...baseMission,
        status: "active",
        public_token_revoked_at: "2026-07-27T11:00:00.000Z",
      }),
    ).toBe(false);
    expect(
      isMissionPubliclyAvailable({
        ...baseMission,
        status: "active",
        playbook_version_id: null,
      }),
    ).toBe(false);
  });
});

describe("buildMissionStatusPatch", () => {
  it("refuses activation without a published Playbook version", () => {
    expect(
      buildMissionStatusPatch(
        { ...baseMission, playbook_version_id: null },
        "active",
        "2026-07-27T12:00:00.000Z",
        () => "new-token",
      ),
    ).toEqual({
      ok: false,
      error: "Cannot activate a Mission without a published Playbook version.",
    });
  });

  it("keeps a stable public token on normal reactivation", () => {
    expect(
      buildMissionStatusPatch(baseMission, "active", "2026-07-27T12:00:00.000Z", () => "new-token"),
    ).toEqual({
      ok: true,
      patch: {
        status: "active",
        public_token: "token-1",
        public_token_revoked_at: null,
        published_at: "2026-07-27T10:00:00.000Z",
      },
    });
  });

  it("issues a new token when the previous public link was revoked", () => {
    expect(
      buildMissionStatusPatch(
        { ...baseMission, public_token_revoked_at: "2026-07-27T11:00:00.000Z" },
        "active",
        "2026-07-27T12:00:00.000Z",
        () => "new-token",
      ),
    ).toEqual({
      ok: true,
      patch: {
        status: "active",
        public_token: "new-token",
        public_token_revoked_at: null,
        published_at: "2026-07-27T10:00:00.000Z",
      },
    });
  });

  it("does not mutate publication fields when unpublishing", () => {
    expect(
      buildMissionStatusPatch(baseMission, "paused", "2026-07-27T12:00:00.000Z", () => "new-token"),
    ).toEqual({ ok: true, patch: { status: "paused" } });
  });
});

describe("canDeleteMission", () => {
  it("blocks active Missions and Missions with produced data", () => {
    expect(canDeleteMission({ status: "active", dossierCount: 0, sessionCount: 0 })).toEqual({
      ok: false,
      error: "Unpublish this Mission before deleting it.",
    });
    expect(canDeleteMission({ status: "paused", dossierCount: 1, sessionCount: 0 })).toEqual({
      ok: false,
      error: "This Mission already has visitor sessions or Project Briefs. Archive it instead.",
    });
    expect(canDeleteMission({ status: "paused", dossierCount: 0, sessionCount: 1 }).ok).toBe(false);
  });

  it("allows deleting an unpublished Mission with no produced data", () => {
    expect(canDeleteMission({ status: "draft", dossierCount: 0, sessionCount: 0 })).toEqual({
      ok: true,
    });
  });
});

describe("duplicatePlaybookName", () => {
  it("creates a bounded independent draft name", () => {
    expect(duplicatePlaybookName("Deck Intake")).toBe("Copy of Deck Intake");
    expect(duplicatePlaybookName("   ")).toBe("Copy of Untitled Playbook");
    expect(duplicatePlaybookName("x".repeat(220))).toHaveLength(200);
  });
});
