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

import { runPlaybookDraftGeneration } from "./playbookDraftGeneration";

beforeEach(() => {
  generateTextMock.mockReset();
});

describe("runPlaybookDraftGeneration", () => {
  it("returns the generated steps and fields", async () => {
    generateTextMock.mockResolvedValue({
      output: {
        steps: [
          {
            title: "What kind of binding project is this?",
            why: "Routes the request appropriately.",
            fields: [
              { label: "Project type", type: "single_choice", required: true, options: ["Restoration", "New binding"] },
            ],
          },
        ],
      },
    });

    const result = await runPlaybookDraftGeneration("Atelier de reliure", "Reliure de livres");

    expect(result.status).toBe("ok");
    expect(result.data?.steps).toHaveLength(1);
    expect(result.data?.steps[0]?.fields[0]?.type).toBe("single_choice");
  });

  it("accepts a step with no fields rather than forcing an invention", async () => {
    generateTextMock.mockResolvedValue({ output: { steps: [{ title: "Notes", why: "", fields: [] }] } });

    const result = await runPlaybookDraftGeneration("Test", "Test product");

    expect(result.status).toBe("ok");
    expect(result.data?.steps[0]?.fields).toEqual([]);
  });

  it("passes the business type and product to the model", async () => {
    let capturedPrompt = "";
    generateTextMock.mockImplementation(async ({ prompt }: { prompt: string }) => {
      capturedPrompt = prompt;
      return { output: { steps: [] } };
    });

    await runPlaybookDraftGeneration("Atelier de reliure", "Reliure de livres");

    expect(capturedPrompt).toContain("Atelier de reliure");
    expect(capturedPrompt).toContain("Reliure de livres");
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

    const result = await runPlaybookDraftGeneration("Atelier de reliure", "Reliure de livres");

    expect(result.status).toBe("error");
    expect(result.error).toContain("finishReason=stop");
  });
});
