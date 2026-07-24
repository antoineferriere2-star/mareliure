// Server-side Anthropic client for the AI Engine (src/build/ai/).
// Never import this from client code — route files and *.functions.ts ship
// to the client bundle; only other *.server.ts modules may import it at the
// top level. Load inside server handlers instead:
//   const { anthropic, getAiModel } = await import("@/build/ai/client.server");
import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = "claude-opus-4-8";

function createAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing ANTHROPIC_API_KEY. Configure the AI Engine's server-only environment variable to use 'Analyser avec l'IA'.",
    );
  }
  return new Anthropic({ apiKey });
}

/** Configurable via ANTHROPIC_MODEL so the model can be swapped without a code change. */
export function getAiModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

let _anthropic: Anthropic | undefined;

export const anthropic = new Proxy({} as Anthropic, {
  get(_, prop, receiver) {
    if (!_anthropic) _anthropic = createAnthropicClient();
    return Reflect.get(_anthropic, prop, receiver);
  },
});
