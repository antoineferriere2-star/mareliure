import { describe, expect, it } from "vitest";
import {
  DRAFT_GENERATION_ATTEMPTS,
  isTransientAiError,
} from "./hermesProspectFunnels.server";

describe("Hermes transient draft-generation errors", () => {
  it("retries a few times before giving up", () => {
    expect(DRAFT_GENERATION_ATTEMPTS).toBe(3);
  });

  it("treats gateway weather as transient", () => {
    for (const message of [
      "429 Too Many Requests",
      "Rate limit exceeded, try again later",
      "The request timed out",
      "Bad gateway",
      "Model temporarily unavailable",
      "503 Service Unavailable",
      "Model overloaded",
    ]) {
      expect(isTransientAiError(new Error(message))).toBe(true);
    }
  });

  it("does not retry a verdict", () => {
    for (const message of [
      "Confirm the product before generating the draft.",
      'Budget option "1 200 €" is not compatible with the US/USD market.',
      "This draft is not valid and cannot be published yet.",
    ]) {
      expect(isTransientAiError(new Error(message))).toBe(false);
    }
  });
});

describe("Hermes draft-generation backoff", () => {
  it("waits longer between each retry instead of hammering the gateway", async () => {
    const { DRAFT_RETRY_BACKOFF_MS, draftRetryDelayMs } = await import(
      "./hermesProspectFunnels.server"
    );
    expect(DRAFT_RETRY_BACKOFF_MS.length).toBe(2);
    expect(draftRetryDelayMs(1)).toBeGreaterThan(0);
    expect(draftRetryDelayMs(2)).toBeGreaterThan(draftRetryDelayMs(1));
    // Beyond the last gap the delay stays bounded, never undefined.
    expect(draftRetryDelayMs(9)).toBe(draftRetryDelayMs(2));
  });
});

describe("Hermes internal API surface", () => {
  it("accepts the campaign vertical alongside company, site, and request id", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("src/routes/api/internal/hermes/prospect-funnels.ts", "utf8"),
    );
    for (const field of ["companyName", "websiteUrl", "vertical", "campaignId", "requestId"]) {
      expect(source).toContain(`${field}:`);
    }
  });

  it("never tells the admin to generate a draft by hand when generation failed", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("src/build/services/hermesProspectFunnels.server.ts", "utf8"),
    );
    expect(source).not.toContain("Generate the draft before publishing.");
    expect(source).toContain("retry the generate step");
  });
});

describe("Hermes stale funnel release", () => {
  it("waits before releasing, then releases at the funnel's own last step", async () => {
    const { isStaleInFlight, staleStep, STALE_IN_FLIGHT_MINUTES } = await import(
      "./hermesProspectFunnels.server"
    );
    const now = new Date("2026-09-01T16:00:00Z");
    const fresh = new Date(now.getTime() - 60_000).toISOString();
    const old = new Date(now.getTime() - (STALE_IN_FLIGHT_MINUTES + 5) * 60_000).toISOString();
    expect(isStaleInFlight(fresh, now)).toBe(false);
    expect(isStaleInFlight(old, now)).toBe(true);
    expect(staleStep({ playbook_id: "p" })).toBe("publish");
    expect(staleStep({ confirmed_product: "Deck" })).toBe("generate");
    expect(staleStep({ analyzed_at: old })).toBe("confirm");
    expect(staleStep({})).toBe("analyze");
  });
});
