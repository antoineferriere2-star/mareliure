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

import { runOnboardingExtraction } from "./onboardingExtraction";

const site: ExtractedSiteText = {
  title: "Sanibel Decks — Deck Builder",
  metaDescription: "We build custom decks in Florida.",
  visibleText: "New Deck. Deck Replacement. Deck Resurfacing. Composite Decking. Call us today.",
};

beforeEach(() => {
  generateTextMock.mockReset();
});

describe("runOnboardingExtraction", () => {
  it("returns the detected business type and products", async () => {
    generateTextMock.mockResolvedValue({
      output: {
        businessTypeCandidates: ["Deck Builder"],
        products: ["New Deck", "Deck Replacement", "Deck Resurfacing", "Composite Decking"],
      },
    });

    const result = await runOnboardingExtraction(site);

    expect(result.status).toBe("ok");
    expect(result.data?.businessTypeCandidates).toEqual(["Deck Builder"]);
    expect(result.data?.products).toHaveLength(4);
  });

  it("accepts an empty products list rather than forcing an invention", async () => {
    generateTextMock.mockResolvedValue({
      output: { businessTypeCandidates: ["Entreprise générale"], products: [] },
    });

    const result = await runOnboardingExtraction({ title: null, metaDescription: null, visibleText: "" });

    expect(result.status).toBe("ok");
    expect(result.data?.products).toEqual([]);
  });

  it("passes the site title, meta description and visible text to the model", async () => {
    let capturedPrompt = "";
    generateTextMock.mockImplementation(async ({ prompt }: { prompt: string }) => {
      capturedPrompt = prompt;
      return { output: { businessTypeCandidates: [], products: [] } };
    });

    await runOnboardingExtraction(site);

    expect(capturedPrompt).toContain("Sanibel Decks — Deck Builder");
    expect(capturedPrompt).toContain("We build custom decks in Florida.");
    expect(capturedPrompt).toContain("Composite Decking");
  });

  it("surfaces a parsing failure without crashing", async () => {
    const { NoObjectGeneratedError } = await vi.importActual<typeof import("ai")>("ai");
    generateTextMock.mockRejectedValue(
      new NoObjectGeneratedError({
        message: "No object generated.",
        text: "not json",
        finishReason: "stop",
        response: { id: "mock", timestamp: new Date(), modelId: "mock-model" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        usage: {} as any,
      }),
    );

    const result = await runOnboardingExtraction(site);

    expect(result.status).toBe("error");
    expect(result.error).toContain("finishReason=stop");
  });
});
