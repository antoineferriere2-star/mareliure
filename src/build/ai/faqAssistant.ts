// Visitor-facing FAQ assistant for the public homepage — a distinct, much
// smaller AI surface than the Dossier AI Agents (analyste/technicien/
// verificateur/redacteur). Stateless by design: one question in, one answer
// out, no conversation history kept anywhere (see faq-ask.ts route doc).
import { z } from "zod";
import { runAgent } from "./runAgent";
import { FAQ_ASSISTANT_SYSTEM_PROMPT } from "./prompts";

export const faqAnswerOutput = z.object({ answer: z.string() });
export type FaqAnswerOutput = z.infer<typeof faqAnswerOutput>;

export async function answerFaqQuestion(question: string) {
  return runAgent(FAQ_ASSISTANT_SYSTEM_PROMPT, question, faqAnswerOutput);
}
