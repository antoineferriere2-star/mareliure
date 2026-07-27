import { describe, it, expect, vi } from "vitest";
import { resolvePostAuthDestination, PROVISION_ERROR } from "./postAuthRoute";

const ok = () => vi.fn(async () => ({}));
const fail = () => vi.fn(async () => Promise.reject(new Error("403")));

describe("resolvePostAuthDestination", () => {
  it("sends a Métré admin to /build without provisioning", async () => {
    const provision = vi.fn();
    const dest = await resolvePostAuthDestination({
      checkAdmin: ok(),
      checkWorkspace: fail(),
      provision: provision as never,
    });
    expect(dest).toEqual({ to: "/build" });
    expect(provision).not.toHaveBeenCalled();
  });

  it("sends an existing workspace member to /portal without provisioning", async () => {
    const provision = vi.fn();
    const dest = await resolvePostAuthDestination({
      checkAdmin: fail(),
      checkWorkspace: ok(),
      provision: provision as never,
    });
    expect(dest).toEqual({ to: "/portal" });
    expect(provision).not.toHaveBeenCalled();
  });

  it("provisions then goes to /portal for a client with no workspace", async () => {
    const provision = vi.fn(async () => ({ status: "provisioned" as const }));
    const dest = await resolvePostAuthDestination({
      checkAdmin: fail(),
      checkWorkspace: fail(),
      provision,
    });
    expect(dest).toEqual({ to: "/portal" });
    expect(provision).toHaveBeenCalledTimes(1);
  });

  it("returns a recoverable error instead of looping when provisioning fails", async () => {
    const dest = await resolvePostAuthDestination({
      checkAdmin: fail(),
      checkWorkspace: fail(),
      provision: vi.fn(async () => Promise.reject(new Error("500"))) as never,
    });
    expect(dest).toEqual({ to: null, error: PROVISION_ERROR });
  });
});
