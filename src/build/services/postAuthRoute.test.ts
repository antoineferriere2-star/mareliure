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

  describe("?redirect= from /free-inquiry-audit", () => {
    const ok = () => vi.fn(async () => ({}));

    it("sends a client with a workspace straight to setup", async () => {
      // Otherwise someone who just saw their analysis lands on an empty
      // portal and has to find the setup wizard themselves.
      const dest = await resolvePostAuthDestination(
        { checkAdmin: fail(), checkWorkspace: ok(), provision: fail() },
        "/portal/setup",
      );
      expect(dest).toEqual({ to: "/portal/setup" });
    });

    it("honours it for a brand-new account too, right after provisioning", async () => {
      const dest = await resolvePostAuthDestination(
        {
          checkAdmin: fail(),
          checkWorkspace: fail(),
          provision: vi.fn(async () => ({ status: "provisioned" as const })),
        },
        "/portal/setup",
      );
      expect(dest).toEqual({ to: "/portal/setup" });
    });

    it.each([
      ["an absolute URL", "https://evil.example.com"],
      ["a protocol-relative URL", "//evil.example.com"],
      ["a path traversal", "/portal/setup/../../admin"],
      ["an admin path", "/build"],
      ["an unknown portal path", "/portal/billing"],
    ])("ignores %s and falls back to /portal", async (_label, requested) => {
      // The value comes from a URL anyone can craft and send to a customer.
      // It is matched against an allow-list, never sanitised into shape.
      const dest = await resolvePostAuthDestination(
        { checkAdmin: fail(), checkWorkspace: ok(), provision: fail() },
        requested,
      );
      expect(dest).toEqual({ to: "/portal" });
    });

    it("never diverts an admin away from /build", async () => {
      const dest = await resolvePostAuthDestination(
        { checkAdmin: ok(), checkWorkspace: fail(), provision: fail() },
        "/portal/setup",
      );
      expect(dest).toEqual({ to: "/build" });
    });
  });
});
