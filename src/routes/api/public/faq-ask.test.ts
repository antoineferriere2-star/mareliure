import { beforeEach, describe, expect, it, vi } from "vitest";

const answerFaqQuestionMock = vi.fn();
vi.mock("@/build/ai/faqAssistant", () => ({
  answerFaqQuestion: (...args: unknown[]) => answerFaqQuestionMock(...args),
}));

import { answerFaqRequest, truncateToWords } from "./faq-ask";

beforeEach(() => {
  answerFaqQuestionMock.mockReset();
});

describe("truncateToWords", () => {
  it("leaves a short answer unchanged", () => {
    expect(truncateToWords("No, it is not a chatbot.", 80)).toBe("No, it is not a chatbot.");
  });

  it("truncates an answer longer than the word limit and adds an ellipsis", () => {
    const long = Array.from({ length: 120 }, (_, i) => `word${i}`).join(" ");
    const result = truncateToWords(long, 80);
    expect(result.split(/\s+/)).toHaveLength(80);
    expect(result.endsWith("…")).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    expect(truncateToWords("  hello world  ", 80)).toBe("hello world");
  });
});

describe("answerFaqRequest", () => {
  it("returns the (truncated) model answer on success, flagged as not a fallback", async () => {
    answerFaqQuestionMock.mockResolvedValue({
      status: "ok",
      data: { answer: "No, it's a structured qualification journey, not a generic chat." },
    });

    const result = await answerFaqRequest("Is this a chatbot?");

    expect(result.answer).toContain("structured qualification journey");
    expect(result.usedFallback).toBe(false);
  });

  it("truncates an overly long model answer to the word backstop", async () => {
    const long = Array.from({ length: 200 }, (_, i) => `word${i}`).join(" ");
    answerFaqQuestionMock.mockResolvedValue({ status: "ok", data: { answer: long } });

    const result = await answerFaqRequest("Tell me everything");

    expect(result.answer.split(/\s+/)).toHaveLength(80);
  });

  it("returns a generic fallback, never a raw error, when the agent fails — and flags it as a fallback", async () => {
    answerFaqQuestionMock.mockResolvedValue({ status: "error", error: "Gateway 429 rate limited" });

    const result = await answerFaqRequest("How much does it cost?");

    expect(result.answer).not.toContain("Gateway");
    expect(result.answer).not.toContain("429");
    expect(result.answer.length).toBeGreaterThan(0);
    expect(result.usedFallback).toBe(true);
  });

  it("returns a generic fallback, never throws, on an unexpected exception — and flags it as a fallback", async () => {
    answerFaqQuestionMock.mockRejectedValue(new Error("network down"));

    const result = await answerFaqRequest("Does it integrate with my CRM?");

    expect(result.answer).not.toContain("network down");
    expect(result.answer.length).toBeGreaterThan(0);
    expect(result.usedFallback).toBe(true);
  });

  it("answers in Spanish when the visitor's locale is es-US, including the fallback path", async () => {
    answerFaqQuestionMock.mockResolvedValue({ status: "error", error: "boom" });

    const result = await answerFaqRequest("¿Cuánto cuesta?", "es-US");

    expect(result.usedFallback).toBe(true);
    expect(result.answer).toMatch(/equipo/i);
  });

  it("defaults to English when no locale is given", async () => {
    answerFaqQuestionMock.mockResolvedValue({ status: "error", error: "boom" });

    const result = await answerFaqRequest("How much does it cost?");

    expect(result.answer).toMatch(/team/i);
  });
});
