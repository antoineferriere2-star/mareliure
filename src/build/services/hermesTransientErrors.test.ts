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
