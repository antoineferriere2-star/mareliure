// Guards the *wiring*, not the rules — entitlements.test.ts already covers
// the state machine. What this file protects against is the regression that
// caused the original bug: the state existing in the database while no call
// site actually consults it. Source-level assertions because these are
// TanStack server functions wrapped in HTTP/auth middleware, which cannot be
// invoked outside a real request (same reasoning as billingServerContract).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");
}

const onboardingServer = read("src/build/services/portalOnboarding.data.functions.ts");
const portalServer = read("src/build/services/portal.data.functions.ts");
const entitlementsServer = read("src/build/services/workspaceEntitlements.server.ts");

function indexOf(source: string, fragment: string): number {
  const index = source.indexOf(fragment);
  expect(index, `Missing fragment: ${fragment}`).toBeGreaterThanOrEqual(0);
  return index;
}

describe("entitlement enforcement wiring", () => {
  it("gates publishing before the Mission is created", () => {
    const gate = indexOf(onboardingServer, "await assertCanPublish(data.workspaceId)");
    const rpc = indexOf(onboardingServer, 'sb.rpc("publish_workspace_onboarding"');
    expect(gate).toBeLessThan(rpc);
  });

  it("lets an already-published workspace re-read its Intake without hitting the gate", () => {
    // Idempotent re-call must not 402 a frozen workspace out of its own data.
    // Since multiple Intakes per workspace landed, "already published" is no
    // longer a status on the in-flight row — it is the absence of one, with
    // the most recent published setup returned instead.
    const shortCircuit = indexOf(onboardingServer, "const published = await loadDisplayRow(");
    const gate = indexOf(onboardingServer, "await assertCanPublish(data.workspaceId)");
    expect(shortCircuit).toBeLessThan(gate);
  });

  it("gates reactivating a paused Mission, and checks the plan limit too", () => {
    const gate = indexOf(portalServer, "await assertCanPublish(data.workspaceId)");
    const limit = indexOf(portalServer, "wouldExceedActiveMissions(");
    const update = indexOf(portalServer, '.update({ status: data.paused ? "paused" : "active" })');
    expect(gate).toBeLessThan(update);
    expect(limit).toBeLessThan(update);
  });

  it("only gates reactivation, never pausing", () => {
    // Pausing frees a slot; blocking it would trap a frozen workspace with a
    // live Intake it cannot take down.
    expect(portalServer).toContain('if (!data.paused && mission.status === "paused")');
  });

  it("refuses a blocked publish with 402 so the portal can route to checkout", () => {
    expect(entitlementsServer).toContain("fail(402,");
  });

  it("derives access from the shared state machine, never from a raw status string", () => {
    expect(entitlementsServer).toContain("resolveEntitlements(");

    // The publish path must not reason about Stripe status on its own — that
    // divergence is what let a canceled workspace keep publishing.
    expect(onboardingServer).not.toContain("subscription_status");

    // portal.data.functions.ts does read the raw status, but only to echo it
    // on the billing screen; every access decision there goes through the
    // guard. Assert both halves so a future gate can't quietly bypass it.
    expect(portalServer).toContain("subscriptionStatus: workspace.subscription_status");
    expect(portalServer).toContain("assertCanPublish(");
  });
});
