import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectBrief } from "@/build/schema/brief";

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

import { runAiAnalysis } from "./runAnalysis";
import {
  ANALYSTE_SYSTEM_PROMPT,
  REDACTEUR_SYSTEM_PROMPT,
  TECHNICIEN_SYSTEM_PROMPT,
  VERIFICATEUR_SYSTEM_PROMPT,
} from "./prompts";

const brief: ProjectBrief = {
  generatedAt: new Date().toISOString(),
  missionName: "Rénovation cuisine",
  status: "ready",
  projectSummary: "Un projet de rénovation de cuisine de 12 m².",
  confirmedInformation: [{ label: "Surface", value: "12 m²", source: "visitor_answer" }],
  assumptionsAndCalculated: [],
  constraints: [{ label: "Délai", value: "avant Noël", source: "visitor_answer" }],
  missingInformation: [],
  budgetAndTiming: [{ label: "Budget", value: "15000-20000€", source: "visitor_answer" }],
  confidence: { score: 80, label: "high", reasons: ["Toutes les informations essentielles sont présentes."] },
  suggestedNextAction: { label: "Action", value: "Planifier un appel", source: "deterministic_rule" },
};

const mission = { name: "Rénovation cuisine", objective: "Cuisine ouverte sur salon" };

beforeEach(() => {
  generateTextMock.mockReset();
});

describe("runAiAnalysis", () => {
  it("runs all four agents in parallel and returns structured insights", async () => {
    generateTextMock.mockImplementation(async ({ system }: { system: string }) => {
      if (system === ANALYSTE_SYSTEM_PROMPT) return { output: { summary: "RAS", findings: [] } };
      if (system === TECHNICIEN_SYSTEM_PROMPT) {
        return { output: { summary: "RAS", findings: [], knowledgeNoteTitlesUsed: ["Norme X"] } };
      }
      if (system === VERIFICATEUR_SYSTEM_PROMPT) {
        return { output: { summary: "RAS", findings: [{ label: "Budget", detail: "Cohérent", severity: "info" }] } };
      }
      if (system === REDACTEUR_SYSTEM_PROMPT) return { output: { narrative: "Projet clair et cohérent." } };
      throw new Error("unexpected system prompt");
    });

    const insights = await runAiAnalysis(mission, brief, [{ title: "Norme X", content: "Détail" }]);

    expect(generateTextMock).toHaveBeenCalledTimes(4);
    expect(insights.model).toBe("google/gemini-3.6-flash-test");
    expect(insights.analyste).toEqual({ status: "ok", data: { summary: "RAS", findings: [] } });
    expect(insights.technicien.data?.knowledgeNoteTitlesUsed).toEqual(["Norme X"]);
    expect(insights.verificateur.data?.findings[0]?.severity).toBe("info");
    expect(insights.redacteur.data?.narrative).toContain("cohérent");
  });

  it("isolates a single agent failure without failing the other three", async () => {
    generateTextMock.mockImplementation(async ({ system }: { system: string }) => {
      if (system === TECHNICIEN_SYSTEM_PROMPT) throw new Error("rate limited");
      if (system === ANALYSTE_SYSTEM_PROMPT) return { output: { summary: "ok", findings: [] } };
      if (system === VERIFICATEUR_SYSTEM_PROMPT) return { output: { summary: "ok", findings: [] } };
      if (system === REDACTEUR_SYSTEM_PROMPT) return { output: { narrative: "ok" } };
      throw new Error("unexpected system prompt");
    });

    const insights = await runAiAnalysis(mission, brief, []);

    expect(insights.technicien.status).toBe("error");
    expect(insights.technicien.error).toContain("rate limited");
    expect(insights.analyste.status).toBe("ok");
    expect(insights.verificateur.status).toBe("ok");
    expect(insights.redacteur.status).toBe("ok");
  });

  it("shares the Dossier context with every agent but only sends knowledge notes to the Technicien", async () => {
    const capturedUserMessages: Record<string, string> = {};
    generateTextMock.mockImplementation(async ({ system, prompt }: { system: string; prompt: string }) => {
      capturedUserMessages[system] = prompt;
      return system === REDACTEUR_SYSTEM_PROMPT
        ? { output: { narrative: "x" } }
        : { output: { summary: "x", findings: [], knowledgeNoteTitlesUsed: [] } };
    });

    await runAiAnalysis(mission, brief, [{ title: "Norme Y", content: "Contenu Y" }]);

    expect(capturedUserMessages[ANALYSTE_SYSTEM_PROMPT]).toContain("Rénovation cuisine");
    expect(capturedUserMessages[ANALYSTE_SYSTEM_PROMPT]).not.toContain("Norme Y");
    expect(capturedUserMessages[TECHNICIEN_SYSTEM_PROMPT]).toContain("Norme Y");
  });
});
