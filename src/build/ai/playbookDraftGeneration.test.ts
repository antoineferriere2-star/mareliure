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

import {
  PLAYBOOK_DRAFT_GENERATION_SYSTEM_PROMPT,
  runPlaybookDraftGeneration,
  validateUsMarketDraft,
} from "./playbookDraftGeneration";

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
              {
                label: "Project type",
                type: "single_choice",
                required: true,
                options: ["Restoration", "New binding"],
              },
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
    generateTextMock.mockResolvedValue({
      output: { steps: [{ title: "Notes", why: "", fields: [] }] },
    });

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

  it("forces native US English and US units in the system prompt", () => {
    expect(PLAYBOOK_DRAFT_GENERATION_SYSTEM_PROMPT).toContain("Always write native US English");
    expect(PLAYBOOK_DRAFT_GENERATION_SYSTEM_PROMPT).toContain("USD");
    expect(PLAYBOOK_DRAFT_GENERATION_SYSTEM_PROMPT).toContain("square feet/feet/inches");
    expect(PLAYBOOK_DRAFT_GENERATION_SYSTEM_PROMPT).toContain("Never use euros, EUR, m², sqm");
    expect(PLAYBOOK_DRAFT_GENERATION_SYSTEM_PROMPT).not.toContain("Réponds en français");
  });

  it("passes an English user prompt shape to the model even for French source inputs", async () => {
    let capturedSystem = "";
    let capturedPrompt = "";
    generateTextMock.mockImplementation(
      async ({ system, prompt }: { system: string; prompt: string }) => {
        capturedSystem = system;
        capturedPrompt = prompt;
        return { output: { steps: [] } };
      },
    );

    await runPlaybookDraftGeneration("Atelier de reliure", "Reliure de livres");

    expect(capturedSystem).toContain("Always write native US English");
    expect(capturedPrompt).toContain("Business type: Atelier de reliure");
    expect(capturedPrompt).toContain("Product / project type: Reliure de livres");
    expect(capturedPrompt).not.toContain("Métier");
  });

  it("rejects generated budget options that use non-US currency or units", async () => {
    generateTextMock.mockResolvedValue({
      output: {
        steps: [
          {
            title: "Budget",
            why: "Sets expectations.",
            fields: [
              {
                label: "Budget range",
                type: "budget",
                required: true,
                options: ["7 000-15 000 €/m²", "Not sure yet"],
              },
            ],
          },
        ],
      },
    });

    const result = await runPlaybookDraftGeneration("Deck builder", "Deck project");

    expect(result.status).toBe("error");
    expect(result.error).toContain("not compatible with the US/USD market");
  });

  it("accepts USD budget ranges", () => {
    expect(
      validateUsMarketDraft({
        steps: [
          {
            title: "Budget",
            why: "Sets expectations.",
            fields: [
              {
                label: "Budget range",
                type: "budget",
                required: true,
                options: ["Under $1,000", "$1,000-$5,000", "$5,000-$15,000", "Not sure yet"],
              },
            ],
          },
        ],
      }),
    ).toBeNull();
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
