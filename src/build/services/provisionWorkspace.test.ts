import { describe, it, expect, vi } from "vitest";
import {
  deriveWorkspaceName,
  ensureOwnerWorkspace,
  provisionInputSchema,
  DEFAULT_WORKSPACE_NAME,
  type ProvisionDeps,
} from "./provisionWorkspace";

function makeDeps(over: Partial<ProvisionDeps> = {}) {
  const state = { workspaces: new Map<string, string>() };
  const deps: ProvisionDeps = {
    isAdmin: vi.fn(async () => false),
    findMembership: vi.fn(async (userId: string) => state.workspaces.get(userId) ?? null),
    provision: vi.fn(async (userId: string) => {
      // Mirrors the DB routine: idempotent per user.
      const existing = state.workspaces.get(userId);
      if (existing) return existing;
      const id = `ws-${userId}`;
      state.workspaces.set(userId, id);
      return id;
    }),
    ...over,
  };
  return { deps, state };
}

describe("deriveWorkspaceName", () => {
  it("uses the company typed at sign-up", () => {
    expect(deriveWorkspaceName("  Sunrise  Decks  ", "jo@sunrise.com")).toBe("Sunrise Decks");
  });
  it("falls back to the email local part", () => {
    expect(deriveWorkspaceName("", "jo@sunrise.com")).toBe("jo's Workspace");
  });
  it("falls back to a neutral English label", () => {
    expect(deriveWorkspaceName(null, null)).toBe(DEFAULT_WORKSPACE_NAME);
  });
});

describe("provisionInputSchema", () => {
  it("never accepts a browser-supplied user id", () => {
    const parsed = provisionInputSchema.parse({ company: "Acme", userId: "someone-else" });
    expect(parsed).toEqual({ company: "Acme" });
    expect("userId" in parsed).toBe(false);
  });
});

describe("ensureOwnerWorkspace", () => {
  it("provisions a workspace on first sign-in", async () => {
    const { deps } = makeDeps();
    const res = await ensureOwnerWorkspace(deps, {
      userId: "u1",
      email: "jo@sunrise.com",
      company: "Sunrise Decks",
    });
    expect(res).toEqual({ status: "provisioned", workspaceId: "ws-u1" });
    expect(deps.provision).toHaveBeenCalledWith("u1", "jo@sunrise.com", "Sunrise Decks");
  });

  it("is idempotent on retry / double confirmation", async () => {
    const { deps } = makeDeps();
    const a = await ensureOwnerWorkspace(deps, { userId: "u1", email: "a@b.com" });
    const b = await ensureOwnerWorkspace(deps, { userId: "u1", email: "a@b.com" });
    const c = await ensureOwnerWorkspace(deps, { userId: "u1", email: "a@b.com" });
    expect(a.status).toBe("provisioned");
    expect(b).toEqual({ status: "existing", workspaceId: "ws-u1" });
    expect(c).toEqual({ status: "existing", workspaceId: "ws-u1" });
    expect(deps.provision).toHaveBeenCalledTimes(1);
  });

  it("provisions an older account that has no workspace yet", async () => {
    const { deps } = makeDeps();
    const res = await ensureOwnerWorkspace(deps, { userId: "legacy", email: "old@b.com" });
    expect(res.status).toBe("provisioned");
  });

  it("does not touch a user who is already a member", async () => {
    const { deps, state } = makeDeps();
    state.workspaces.set("u2", "ws-existing");
    const res = await ensureOwnerWorkspace(deps, { userId: "u2", email: "a@b.com" });
    expect(res).toEqual({ status: "existing", workspaceId: "ws-existing" });
    expect(deps.provision).not.toHaveBeenCalled();
  });

  it("never provisions a workspace for a Métré admin", async () => {
    const { deps } = makeDeps({ isAdmin: vi.fn(async () => true) });
    const res = await ensureOwnerWorkspace(deps, { userId: "admin", email: "a@metre.com" });
    expect(res).toEqual({ status: "admin" });
    expect(deps.provision).not.toHaveBeenCalled();
    expect(deps.findMembership).not.toHaveBeenCalled();
  });

  it("only ever provisions for the authenticated user id", async () => {
    const { deps } = makeDeps();
    await ensureOwnerWorkspace(deps, { userId: "u1", email: "a@b.com", company: "Acme" });
    const calls = (deps.provision as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(calls.every((c) => c[0] === "u1")).toBe(true);
  });
});
