import { describe, it, expect, afterEach, vi } from "vitest";
import { workshopCanCreate, workshopOrigin } from "./workshopSubscription";
afterEach(() => vi.unstubAllEnvs());
describe("droits B", () => {
  it("conserve la gratuité et refuse les créations après expiration ou impayé", () => {
    const s = { legacy_free: false, status: "active", current_period_end: "2026-10-06T00:00:00Z" };
    const now = Date.parse("2026-10-05T00:00:00Z");
    expect(workshopCanCreate(s, true, now)).toBe(true);
    expect(workshopCanCreate({ ...s, status: "past_due" }, true, now)).toBe(false);
    expect(workshopCanCreate({ ...s, current_period_end: "2026-10-04" }, true, now)).toBe(false);
    expect(workshopCanCreate({ ...s, status: "canceled", legacy_free: true }, true, now)).toBe(
      true,
    );
  });
  it("refuse les retours non HTTPS en production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MARKETPLACE_PUBLIC_ORIGIN", "http://example.invalid");
    expect(() => workshopOrigin()).toThrow("workshop_origin_invalid");
  });
});
