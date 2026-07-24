import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { runImageAnalysis } from "./imageAnalysis";

const image = { base64: "ZmFrZS1pbWFnZS1ieXRlcw==", mediaType: "image/jpeg" };

beforeEach(() => {
  generateTextMock.mockReset();
});

describe("runImageAnalysis", () => {
  it("returns the proposed hypotheses", async () => {
    generateTextMock.mockResolvedValue({
      output: {
        style: "Moderne",
        materials: ["Composite"],
        shape: "Rectangulaire",
        elements: ["Garde-corps", "Éclairage"],
        suggestedQuestions: ["Quelle surface envisagez-vous ?"],
      },
    });

    const result = await runImageAnalysis(image);

    expect(result.status).toBe("ok");
    expect(result.data?.style).toBe("Moderne");
    expect(result.data?.materials).toEqual(["Composite"]);
    expect(result.data?.suggestedQuestions).toHaveLength(1);
  });

  it("accepts empty hypotheses rather than forcing a guess", async () => {
    generateTextMock.mockResolvedValue({
      output: { materials: [], elements: [], suggestedQuestions: [] },
    });

    const result = await runImageAnalysis(image);

    expect(result.status).toBe("ok");
    expect(result.data?.style).toBeUndefined();
    expect(result.data?.materials).toEqual([]);
  });

  it("attaches the image as a multimodal message part", async () => {
    let capturedMessages: unknown;
    generateTextMock.mockImplementation(async ({ messages }: { messages: unknown }) => {
      capturedMessages = messages;
      return { output: { materials: [], elements: [], suggestedQuestions: [] } };
    });

    await runImageAnalysis(image, "Le visiteur cherche une terrasse.");

    expect(capturedMessages).toEqual([
      {
        role: "user",
        content: [
          { type: "text", text: expect.stringContaining("Le visiteur cherche une terrasse.") },
          { type: "image", image: image.base64, mediaType: image.mediaType },
        ],
      },
    ]);
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

    const result = await runImageAnalysis(image);

    expect(result.status).toBe("error");
    expect(result.error).toContain("finishReason=stop");
  });
});
