import { describe, expect, it } from "vitest";
import {
  buildFallbackPlaybookDraft,
  buildFallbackSiteAnalysis,
  isAiUnavailableError,
} from "./hermesFallback";
import { expandPlaybookDraft } from "@/build/onboarding/expandPlaybookDraft";
import { playbookSchema } from "@/build/schema/playbook";
import { getPlaybookPublishIssues } from "@/build/engine/validation";
import { validateUsMarketDraft } from "@/build/ai/playbookDraftGeneration";

describe("AI availability detection", () => {
  it("treats missing credentials and gateway weather as unavailable", () => {
    for (const message of [
      "Missing LOVABLE_API_KEY. Lovable AI Gateway is required.",
      "401 Unauthorized",
      "402 payment required: out of credits",
      "429 Too Many Requests",
      "Bad gateway",
      "The request timed out",
      "Model temporarily unavailable",
      "fetch failed",
    ]) {
      expect(isAiUnavailableError(new Error(message))).toBe(true);
    }
  });

  it("does not treat a content verdict as unavailability", () => {
    expect(isAiUnavailableError(new Error("This draft is not valid."))).toBe(false);
    expect(isAiUnavailableError(new Error(""))).toBe(false);
  });
});

describe("deterministic site analysis", () => {
  it("uses the campaign vertical and page signals", () => {
    const analysis = buildFallbackSiteAnalysis(
      { title: "Spiro Custom Pools", metaDescription: null, visibleText: "We build patios and decks." },
      { companyName: "Spiro", vertical: "residential pools", businessType: null },
    );
    expect(analysis.businessType).toBe("Residential pools");
    expect(analysis.products[0]).toBe("Residential pools project");
    expect(analysis.deckSignals).toContain("deck");
    expect(analysis.facts.every((fact) => fact.status === "assumed")).toBe(true);
  });

  it("falls back to a generic contractor when nothing is known", () => {
    const analysis = buildFallbackSiteAnalysis(
      { title: null, metaDescription: null, visibleText: "" },
      {},
    );
    expect(analysis.businessType).toBe("Home improvement contractor");
    expect(analysis.isDeckBusiness).toBe(false);
  });
});

describe("deterministic Playbook draft", () => {
  const draft = buildFallbackPlaybookDraft("Deck builder", "Deck");

  it("respects the US market contract", () => {
    expect(validateUsMarketDraft(draft)).toBeNull();
    expect(JSON.stringify(draft)).not.toMatch(/€|\bm²|\beuro/i);
  });

  it("expands into a publishable Playbook", () => {
    const schema = playbookSchema.safeParse(expandPlaybookDraft(draft, "Deck builder", "Deck"));
    expect(schema.success).toBe(true);
    if (schema.success) expect(getPlaybookPublishIssues(schema.data)).toEqual([]);
  });
});
