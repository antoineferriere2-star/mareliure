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
