// Server-only helper connecting the Vercel AI SDK to the Lovable AI Gateway.
// Never import this from client code — read process.env.LOVABLE_API_KEY inside
// a server function/route handler, then call createLovableAiGatewayProvider().
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createLovableAiGatewayProvider(lovableApiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}
