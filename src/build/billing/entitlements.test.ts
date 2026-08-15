import { describe, expect, it } from "vitest";
import {
  PUBLISH_BLOCKED_MESSAGE,
  resolveEntitlements,
  TRIAL_DAYS,
  type WorkspaceEntitlementInput,
} from "./entitlements";

const NOW = new Date("2026-08-01T12:00:00.000Z");

function daysFromNow(days: number): string {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

/** A self-service signup inside its trial — the baseline every case varies from. */
const selfServe: WorkspaceEntitlementInput = {
  isActive: true,
  provisionedForUserId: "user-1",
  subscriptionStatus: null,
  trialEndsAt: daysFromNow(7),
};

describe("Métré's own Sales / Demos workspace", () => {
  const internal: WorkspaceEntitlementInput = { ...selfServe, workspaceType: "internal_sales" };

  it("is never gated, whatever the billing columns say", () => {
    // The point of checking the type first: an internal workspace must stay
    // out of the funnel even if a stray trial date, a provisioning id or a
    // cancelled subscription ends up on the row.
    for (const overrides of [
      {},
      { trialEndsAt: daysFromNow(-30) },
      { subscriptionStatus: "canceled" },
      { subscriptionStatus: "unpaid", trialEndsAt: daysFromNow(-1) },
      { provisionedForUserId: null as string | null },
    ]) {
      const result = resolveEntitlements({ ...internal, ...overrides }, NOW);
      expect(result.state).toBe("internal_sales");
      expect(result.canPublish).toBe(true);
      expect(result.canAcceptSubmissions).toBe(true);
    }
  });

  it("still obeys the operator kill switch", () => {
    const result = resolveEntitlements({ ...internal, isActive: false }, NOW);
    expect(result.state).toBe("workspace_disabled");
    expect(result.canPublish).toBe(false);
  });

  it("never blocks a publish, so it needs no explanation", () => {
    expect(PUBLISH_BLOCKED_MESSAGE.internal_sales).toBeNull();
  });

  it("leaves a customer workspace exactly where it was", () => {
    // The new field is optional; every existing caller that omits it must
    // resolve to the same state as before.
    expect(resolveEntitlements(selfServe, NOW).state).toBe("trialing");
    expect(resolveEntitlements({ ...selfServe, workspaceType: "client" }, NOW).state).toBe(
      "trialing",
    );
    expect(
      resolveEntitlements({ ...selfServe, workspaceType: null, trialEndsAt: daysFromNow(-1) }, NOW)
        .state,
    ).toBe("trial_expired");
  });
});

describe("resolveEntitlements", () => {
  it("gives an operator-created workspace full access with no subscription", () => {
    const result = resolveEntitlements(
      { ...selfServe, provisionedForUserId: null, subscriptionStatus: null, trialEndsAt: null },
      NOW,
    );
    expect(result.state).toBe("admin_managed");
    expect(result.canPublish).toBe(true);
  });

  it("keeps an operator-created workspace unlocked even after a cancellation event", () => {
    // Enterprise deals have no self-serve Stripe price; a stray status must not gate them.
    const result = resolveEntitlements(
      { ...selfServe, provisionedForUserId: null, subscriptionStatus: "canceled" },
      NOW,
    );
    expect(result.state).toBe("admin_managed");
    expect(result.canPublish).toBe(true);
  });

  it.each(["active", "trialing"])("treats Stripe status %s as subscribed", (status) => {
    const result = resolveEntitlements({ ...selfServe, subscriptionStatus: status }, NOW);
    expect(result.state).toBe("subscribed");
    expect(result.canPublish).toBe(true);
  });

  it("keeps publishing available while a payment is being retried (past_due)", () => {
    const result = resolveEntitlements({ ...selfServe, subscriptionStatus: "past_due" }, NOW);
    expect(result.state).toBe("grace_past_due");
    expect(result.canPublish).toBe(true);
  });

  it.each(["canceled", "unpaid", "incomplete_expired", "paused", "some_future_stripe_status"])(
    "blocks publishing once the subscription is not current (%s)",
    (status) => {
      const result = resolveEntitlements({ ...selfServe, subscriptionStatus: status }, NOW);
      expect(result.state).toBe("subscription_ended");
      expect(result.canPublish).toBe(false);
    },
  );

  it("allows publishing during the local trial and reports the days left", () => {
    const result = resolveEntitlements(selfServe, NOW);
    expect(result.state).toBe("trialing");
    expect(result.canPublish).toBe(true);
    expect(result.trialDaysRemaining).toBe(7);
  });

  it("blocks publishing once the local trial has elapsed", () => {
    const result = resolveEntitlements({ ...selfServe, trialEndsAt: daysFromNow(-1) }, NOW);
    expect(result.state).toBe("trial_expired");
    expect(result.canPublish).toBe(false);
    expect(result.trialDaysRemaining).toBe(0);
  });

  it("treats the exact expiry instant as expired, not as a final free day", () => {
    const result = resolveEntitlements({ ...selfServe, trialEndsAt: NOW.toISOString() }, NOW);
    expect(result.state).toBe("trial_expired");
  });

  it("fails open when a self-service row has no trial date (our bug, not abuse)", () => {
    const result = resolveEntitlements({ ...selfServe, trialEndsAt: null }, NOW);
    expect(result.state).toBe("trialing");
    expect(result.canPublish).toBe(true);
  });

  it("a full trial window rounds to TRIAL_DAYS days remaining", () => {
    const result = resolveEntitlements({ ...selfServe, trialEndsAt: daysFromNow(TRIAL_DAYS) }, NOW);
    expect(result.trialDaysRemaining).toBe(TRIAL_DAYS);
  });

  describe("visitor submissions", () => {
    it.each([
      ["trial_expired", { ...selfServe, trialEndsAt: daysFromNow(-30) }],
      ["subscription_ended", { ...selfServe, subscriptionStatus: "canceled" }],
    ])("keeps already-published Intakes collecting submissions when %s", (_label, input) => {
      // A billing dispute with the customer must never break a form embedded
      // on the customer's own website.
      expect(resolveEntitlements(input, NOW).canAcceptSubmissions).toBe(true);
    });

    it("only the operator kill switch stops submissions", () => {
      const result = resolveEntitlements({ ...selfServe, isActive: false }, NOW);
      expect(result.state).toBe("workspace_disabled");
      expect(result.canAcceptSubmissions).toBe(false);
      expect(result.canPublish).toBe(false);
    });

    it("the kill switch wins over an active subscription", () => {
      const result = resolveEntitlements(
        { ...selfServe, isActive: false, subscriptionStatus: "active" },
        NOW,
      );
      expect(result.state).toBe("workspace_disabled");
    });
  });

  it("every state that blocks publishing carries an explanation, and no other state does", () => {
    for (const [state, message] of Object.entries(PUBLISH_BLOCKED_MESSAGE)) {
      const blocks =
        state === "trial_expired" ||
        state === "subscription_ended" ||
        state === "workspace_disabled";
      expect(typeof message === "string", `${state} message`).toBe(blocks);
    }
  });
});
