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

import {
  GENERIC_SITE_ANALYSIS_SYSTEM_PROMPT,
  genericSiteAnalysisOutput,
  runGenericSiteAnalysis,
} from "./genericSiteAnalysis";

const site: ExtractedSiteText = {
  title: "Coastal Pergolas — Custom Shade Structures",
  metaDescription: "Cedar and aluminum pergolas across the Gulf Coast.",
  visibleText: "We design and install custom pergolas. Free consultation.",
};

beforeEach(() => {
  generateTextMock.mockReset();
});

describe("the generic prompt commits to no vertical", () => {
  it("names several trades as examples rather than one supported trade", () => {
    // A prompt that only mentioned deck builders steered the model toward
    // deck vocabulary for businesses that never build decks.
    for (const trade of ["deck builders", "pergola installers", "fence companies"]) {
      expect(GENERIC_SITE_ANALYSIS_SYSTEM_PROMPT).toContain(trade);
    }
  });

  it("asks the model not to force the business into a supported trade", () => {
    expect(GENERIC_SITE_ANALYSIS_SYSTEM_PROMPT).toContain(
      "Never force the business into a trade you know Métré Build supports",
    );
  });

  it("drops the deck classification fields from the required output", () => {
    expect(GENERIC_SITE_ANALYSIS_SYSTEM_PROMPT).not.toContain("isDeckBusiness");
    expect(GENERIC_SITE_ANALYSIS_SYSTEM_PROMPT).not.toContain("deckSignals");
  });

  it("keeps the provenance rule, since the page shows proved and assumed differently", () => {
    expect(GENERIC_SITE_ANALYSIS_SYSTEM_PROMPT).toContain("sourceQuote");
    expect(GENERIC_SITE_ANALYSIS_SYSTEM_PROMPT).toContain('When in doubt, use "assumed"');
  });
});

describe("genericSiteAnalysisOutput", () => {
  it("rejects a fact whose status is neither proved nor assumed", () => {
    const parsed = genericSiteAnalysisOutput.safeParse({
      businessType: "Pergola installer",
      products: [],
      facts: [{ claim: "Installs pergolas", status: "likely" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts an empty product list rather than requiring invention", () => {
    const parsed = genericSiteAnalysisOutput.safeParse({
      businessType: "Unclear",
      products: [],
      facts: [],
    });
    expect(parsed.success).toBe(true);
  });
});

describe("runGenericSiteAnalysis", () => {
  it("returns the business type, products and per-fact provenance", async () => {
    generateTextMock.mockResolvedValue({
      output: {
        businessType: "Pergola installer",
        products: ["Custom pergolas", "Aluminum shade structures"],
        facts: [
          {
            claim: "Designs and installs pergolas",
            status: "proved",
            sourceQuote: "We design and install custom pergolas.",
          },
          { claim: "Serves residential homeowners", status: "assumed" },
        ],
      },
    });

    const result = await runGenericSiteAnalysis(site);

    expect(result.status).toBe("ok");
    expect(result.data?.businessType).toBe("Pergola installer");
    expect(result.data?.products).toHaveLength(2);
    expect(result.data?.facts[0].status).toBe("proved");
    expect(result.data?.facts[0].sourceQuote).toContain("custom pergolas");
    expect(result.data?.facts[1].sourceQuote).toBeUndefined();
  });

  it("reports a trade Métré Build has no Playbook for, instead of reshaping it", async () => {
    generateTextMock.mockResolvedValue({
      output: {
        businessType: "Bookbinding workshop",
        products: ["Book restoration"],
        facts: [
          {
            claim: "Restores books",
            status: "proved",
            sourceQuote: "Book restoration since 1994.",
          },
        ],
      },
    });

    const result = await runGenericSiteAnalysis(site);

    expect(result.status).toBe("ok");
    expect(result.data?.businessType).toBe("Bookbinding workshop");
  });

  it("passes the page title, meta description and visible text to the model", async () => {
    generateTextMock.mockResolvedValue({
      output: { businessType: "Pergola installer", products: [], facts: [] },
    });

    await runGenericSiteAnalysis(site);

    const prompt = JSON.stringify(generateTextMock.mock.calls[0]?.[0] ?? {});
    expect(prompt).toContain("Coastal Pergolas");
    expect(prompt).toContain("Cedar and aluminum pergolas");
    expect(prompt).toContain("We design and install custom pergolas.");
  });

  it("surfaces a gateway failure instead of returning fabricated data", async () => {
    generateTextMock.mockRejectedValue(new Error("Rate limit exceeded"));

    const result = await runGenericSiteAnalysis(site);

    expect(result.status).toBe("error");
    expect(result.data).toBeUndefined();
    expect(result.error).toContain("Rate limit");
  });
});
