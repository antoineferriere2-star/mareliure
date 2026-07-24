// Shared low-level calls to a single structured-output AI agent, through the
// Lovable AI Gateway (Vercel AI SDK). Used by the Dossier AI Agents
// (runAnalysis.ts), the onboarding site-analysis extraction, and the
// inspiration-photo vision analysis — the failure handling below is
// identical for all three, so it lives in one place.
import { generateText, Output, NoObjectGeneratedError } from "ai";
import type { z, ZodType } from "zod";
import { getGatewayModel } from "./client.server";
import type { AgentResult } from "./schema";

async function toAgentResult<Schema extends ZodType>(
  run: () => Promise<{ output: unknown }>,
): Promise<AgentResult<z.infer<Schema>>> {
  try {
    const { output } = await run();
    return { status: "ok", data: output as z.infer<Schema> };
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) {
      // NoObjectGeneratedError swallows the actual failure reason by default
      // (truncated output, model refusal, markdown-fenced JSON the parser
      // rejected...). Surface finishReason + a snippet of the raw text so a
      // real cause shows up instead of a dead-end generic message.
      const detail = [
        err.finishReason ? `finishReason=${err.finishReason}` : null,
        err.text ? `raw="${err.text.slice(0, 300)}"` : null,
        err.cause instanceof Error ? `cause=${err.cause.message}` : null,
      ]
        .filter(Boolean)
        .join(" — ");
      return {
        status: "error",
        error: detail
          ? `Réponse IA non structurée (parsing échoué) : ${detail}`
          : "Réponse IA non structurée (parsing échoué).",
      };
    }
    // Surface gateway errors verbatim — 429 (rate limit) and 402 (credits) are
    // the most common; the caller renders err.message directly.
    return { status: "error", error: err instanceof Error ? err.message : "Erreur IA inconnue." };
  }
}

export async function runAgent<Schema extends ZodType>(
  systemPrompt: string,
  userMessage: string,
  outputSchema: Schema,
): Promise<AgentResult<z.infer<Schema>>> {
  return toAgentResult<Schema>(() =>
    generateText({
      model: getGatewayModel(),
      system: systemPrompt,
      prompt: userMessage,
      output: Output.object({ schema: outputSchema }),
    }),
  );
}

/** Same as runAgent, but attaches an image to the user message for vision-capable models. */
export async function runVisionAgent<Schema extends ZodType>(
  systemPrompt: string,
  textPrompt: string,
  image: { base64: string; mediaType: string },
  outputSchema: Schema,
): Promise<AgentResult<z.infer<Schema>>> {
  return toAgentResult<Schema>(() =>
    generateText({
      model: getGatewayModel(),
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: textPrompt },
            { type: "image", image: image.base64, mediaType: image.mediaType },
          ],
        },
      ],
      output: Output.object({ schema: outputSchema }),
    }),
  );
}
