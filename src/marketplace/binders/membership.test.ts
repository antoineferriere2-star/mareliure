import { describe, expect, it } from "vitest";
import {
  decideInvitationAcceptance,
  resolveActiveMembership,
  roleForNewMember,
} from "./membership";

describe("resolveActiveMembership", () => {
  it("returns null for an account with no active membership", () => {
    expect(resolveActiveMembership([])).toBeNull();
    expect(
      resolveActiveMembership([
        { binderId: "b1", accountStatus: "invited", createdAt: "2026-01-01" },
      ]),
    ).toBeNull();
  });

  it("ignores memberships that are not active", () => {
    const result = resolveActiveMembership([
      { binderId: "b1", accountStatus: "onboarding", createdAt: "2026-01-01" },
      { binderId: "b2", accountStatus: "active", createdAt: "2026-01-02" },
      { binderId: "b3", accountStatus: "disabled", createdAt: "2026-01-03" },
    ]);
    expect(result?.binderId).toBe("b2");
  });

  it("a legacy, single-membership account resolves to exactly that atelier", () => {
    const result = resolveActiveMembership([
      { binderId: "legacy-binder", accountStatus: "active", createdAt: "2026-09-08" },
    ]);
    expect(result?.binderId).toBe("legacy-binder");
  });

  it("picks the oldest active membership when more than one exists", () => {
    const result = resolveActiveMembership([
      { binderId: "newer", accountStatus: "active", createdAt: "2026-09-10" },
      { binderId: "older", accountStatus: "active", createdAt: "2026-09-01" },
    ]);
    expect(result?.binderId).toBe("older");
  });
});

describe("roleForNewMember", () => {
  it("the first person into a workshop owns it", () => {
    expect(roleForNewMember(0)).toBe("OWNER");
  });

  it("everyone after the first is a member", () => {
    expect(roleForNewMember(1)).toBe("MEMBER");
    expect(roleForNewMember(5)).toBe("MEMBER");
  });
});

describe("decideInvitationAcceptance", () => {
  const base = {
    status: "pending",
    expiresAt: "2026-09-20T00:00:00.000Z",
    invitedEmail: "artisan@example.com",
    accountEmail: "artisan@example.com" as string | null,
    now: new Date("2026-09-12T00:00:00.000Z"),
  };

  it("accepts a valid, unexpired, unconsumed invitation", () => {
    expect(decideInvitationAcceptance(base)).toEqual({ allowed: true });
  });

  it("refuses an expired invitation", () => {
    const result = decideInvitationAcceptance({
      ...base,
      now: new Date("2026-09-21T00:00:00.000Z"),
    });
    expect(result.allowed).toBe(false);
  });

  it("refuses an already-accepted invitation, with the same message as expired", () => {
    const consumed = decideInvitationAcceptance({ ...base, status: "accepted" });
    const expired = decideInvitationAcceptance({
      ...base,
      now: new Date("2026-09-21T00:00:00.000Z"),
    });
    expect(consumed.allowed).toBe(false);
    // Deliberately identical — a stale link must not reveal which happened.
    expect(consumed.reason).toBe(expired.reason);
  });

  it("refuses a revoked invitation", () => {
    expect(decideInvitationAcceptance({ ...base, status: "revoked" }).allowed).toBe(false);
  });

  it("refuses when the signed-in account's e-mail does not match the invited one", () => {
    const result = decideInvitationAcceptance({ ...base, accountEmail: "someone-else@example.com" });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("artisan@example.com");
  });

  it("is case-insensitive on the e-mail match", () => {
    const result = decideInvitationAcceptance({ ...base, accountEmail: "ARTISAN@EXAMPLE.COM" });
    expect(result.allowed).toBe(true);
  });

  it("does not require an account e-mail to be known (null skips the check)", () => {
    expect(decideInvitationAcceptance({ ...base, accountEmail: null }).allowed).toBe(true);
  });
});
