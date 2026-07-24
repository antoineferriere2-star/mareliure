// Server-side entry point for the AI Engine. Uses the Lovable AI Gateway
// (no user-provided API key) via the Vercel AI SDK. Never import from client
// code — route files and *.functions.ts modules ship to the client bundle.
// Load inside server handlers instead:
//   const { getGatewayModel, getAiModel } = await import("@/build/ai/client.server");
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const DEFAULT_MODEL = "google/gemini-3.6-flash";

/** Configurable via LOVABLE_AI_MODEL so the model can be swapped without a code change. */
export function getAiModel(): string {
  return process.env.LOVABLE_AI_MODEL?.trim() || DEFAULT_MODEL;
}

export function getGatewayModel(modelId: string = getAiModel()) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing LOVABLE_API_KEY. Lovable AI Gateway is required to run 'Analyser avec l'IA'.",
    );
  }
  const gateway = createLovableAiGatewayProvider(apiKey);
  return gateway(modelId);
}
