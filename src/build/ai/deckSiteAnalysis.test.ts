import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtractedSiteText } from "@/build/onboarding/extractText";

const generateTextMock = vi.fn();

vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    ...actual,
    generateText: (...args: unknown[]) => generateTextMock(...args),
  };
});

vi.mock("./client.server", () => ({
  getGatewayModel: () => "mock-model" as unknown,
  getAiModel: () => "google/gemini-3.6-flash-test",
}));

import { runDeckSiteAnalysis } from "./deckSiteAnalysis";

const site: ExtractedSiteText = {
  title: "Sanibel Decks — Custom Deck Builder",
  metaDescription: "Composite and wood decks in Southwest Florida.",
  visibleText: "We design and build custom decks. Free estimate.",
};

beforeEach(() => {
  generateTextMock.mockReset();
});

describe("runDeckSiteAnalysis", () => {
  it("returns the business type, deck classification and per-fact provenance", async () => {
    generateTextMock.mockResolvedValue({
      output: {
        businessType: "Deck builder",
        isDeckBusiness: true,
        deckSignals: ["design and build custom decks"],
        products: ["Custom decks", "Composite decking"],
        facts: [
          { claim: "Builds custom decks", status: "proved", sourceQuote: "We design and build custom decks." },
          { claim: "Serves residential homeowners", status: "assumed" },
        ],
      },
    });

    const result = await runDeckSiteAnalysis(site);

    expect(result.status).toBe("ok");
    expect(result.data?.isDeckBusiness).toBe(true);
    expect(result.data?.facts[0].status).toBe("proved");
    expect(result.data?.facts[0].sourceQuote).toContain("custom decks");
    expect(result.data?.facts[1].sourceQuote).toBeUndefined();
  });

  it("reports a non-deck site as such instead of forcing the vertical", async () => {
    generateTextMock.mockResolvedValue({
      output: {
        businessType: "Bookbinding workshop",
        isDeckBusiness: false,
        deckSignals: [],
        products: ["Book restoration"],
        facts: [{ claim: "Restores books", status: "proved", sourceQuote: "Book restoration since 1994." }],
      },
    });

    const result = await runDeckSiteAnalysis(site);

    expect(result.status).toBe("ok");
    expect(result.data?.isDeckBusiness).toBe(false);
    expect(result.data?.deckSignals).toEqual([]);
  });

  it("surfaces a gateway failure instead of returning fabricated data", async () => {
    generateTextMock.mockRejectedValue(new Error("Rate limit exceeded"));

    const result = await runDeckSiteAnalysis(site);

    expect(result.status).toBe("error");
    expect(result.data).toBeUndefined();
    expect(result.error).toContain("Rate limit");
  });
});
