import { describe, expect, it } from "vitest";
import { onboardingTone, workshopOnboarding, type WorkshopOnboardingInput } from "./workshopOnboarding";

const base: WorkshopOnboardingInput = { subscription: null, stripeAccountId: null, chargesEnabled: false, payoutsEnabled: false, hasConnectConsent: false };
const sub = (status: string, extra: Partial<{ legacy_free: boolean; cancel_at_period_end: boolean }> = {}) =>
  ({ ...base, subscription: { status, legacy_free: false, cancel_at_period_end: false, ...extra } });

describe("onboarding d'un atelier", () => {
  it("abonnement : gratuité historique prioritaire, puis état Stripe", () => {
    expect(workshopOnboarding(base).subscription).toBe("none");
    expect(workshopOnboarding(sub("active", { legacy_free: true })).subscription).toBe("legacy_free");
    expect(workshopOnboarding(sub("canceled", { legacy_free: true })).subscription).toBe("legacy_free");
    expect(workshopOnboarding(sub("active")).subscription).toBe("active");
    expect(workshopOnboarding(sub("trialing")).subscription).toBe("active");
    expect(workshopOnboarding(sub("active", { cancel_at_period_end: true })).subscription).toBe("cancelling");
    expect(workshopOnboarding(sub("past_due")).subscription).toBe("late");
    expect(workshopOnboarding(sub("unpaid")).subscription).toBe("late");
    expect(workshopOnboarding(sub("incomplete")).subscription).toBe("pending");
    expect(workshopOnboarding(sub("incomplete_expired")).subscription).toBe("canceled");
    expect(workshopOnboarding(sub("canceled")).subscription).toBe("canceled");
  });

  it("paiement en ligne : seules les capacités Stripe actives comptent comme actif", () => {
    expect(workshopOnboarding(base).onlinePayment).toBe("not_started");
    expect(workshopOnboarding({ ...base, hasConnectConsent: true }).onlinePayment).toBe("consent_only");
    expect(workshopOnboarding({ ...base, hasConnectConsent: true, stripeAccountId: "acct_1" }).onlinePayment).toBe("in_progress");
    expect(workshopOnboarding({ ...base, stripeAccountId: "acct_1", chargesEnabled: true }).onlinePayment).toBe("payouts_pending");
    expect(workshopOnboarding({ ...base, stripeAccountId: "acct_1", chargesEnabled: true, payoutsEnabled: true }).onlinePayment).toBe("active");
  });

  it("met en avant ce qui demande une action", () => {
    expect(onboardingTone("late")).toBe("attention");
    expect(onboardingTone("payouts_pending")).toBe("attention");
    expect(onboardingTone("legacy_free")).toBe("ok");
    expect(onboardingTone("active")).toBe("ok");
    expect(onboardingTone("in_progress")).toBe("neutral");
  });
});
