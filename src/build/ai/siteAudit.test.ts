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

import { runSiteAudit } from "./siteAudit";

const site: ExtractedSiteText = {
  title: "Sanibel Decks — Deck Builder",
  metaDescription: "We build custom decks in Florida.",
  visibleText: "Contact us for a free quote. Call or email us today.",
};

beforeEach(() => {
  generateTextMock.mockReset();
});

describe("runSiteAudit", () => {
  it("returns the audit summary, strengths, gaps and next steps", async () => {
    generateTextMock.mockResolvedValue({
      output: {
        summary: "Le site invite au contact mais ne qualifie pas le projet en amont.",
        strengths: ["Numéro de téléphone visible"],
        gaps: [{ label: "Pas de formulaire structuré", detail: "Aucun champ projet/budget visible.", severity: "warning" }],
        suggestedNextSteps: ["Ajouter un formulaire de qualification avant le contact direct."],
      },
    });

    const result = await runSiteAudit(site, "Demande d'audit de Antoine, société oppe.");

    expect(result.status).toBe("ok");
    expect(result.data?.gaps).toHaveLength(1);
    expect(result.data?.gaps[0]?.severity).toBe("warning");
    expect(result.data?.strengths).toEqual(["Numéro de téléphone visible"]);
  });

  it("accepts empty gaps/strengths rather than forcing an invention", async () => {
    generateTextMock.mockResolvedValue({
      output: { summary: "Rien à signaler.", strengths: [], gaps: [], suggestedNextSteps: [] },
    });

    const result = await runSiteAudit({ title: null, metaDescription: null, visibleText: "" });

    expect(result.status).toBe("ok");
    expect(result.data?.gaps).toEqual([]);
  });

  it("passes the requester context and site content to the model", async () => {
    let capturedPrompt = "";
    generateTextMock.mockImplementation(async ({ prompt }: { prompt: string }) => {
      capturedPrompt = prompt;
      return { output: { summary: "x", strengths: [], gaps: [], suggestedNextSteps: [] } };
    });

    await runSiteAudit(site, "Demande d'audit de Antoine, société oppe.");

    expect(capturedPrompt).toContain("Antoine");
    expect(capturedPrompt).toContain("Sanibel Decks");
    expect(capturedPrompt).toContain("Contact us for a free quote");
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

    const result = await runSiteAudit(site);

    expect(result.status).toBe("error");
    expect(result.error).toContain("finishReason=stop");
  });
});
