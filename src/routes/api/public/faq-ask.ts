// Public, stateless FAQ assistant endpoint for the homepage's "Don't see
// your question? Ask it here." field. Every request is independent — no
// conversation history is kept anywhere, by design (see FAQ_ASSISTANT_
// SYSTEM_PROMPT's own scope rules). Rate-limited more strictly than the
// read-only project-summary endpoint, since every request here costs a
// real LLM call, sitting outside the per-Dossier quota system entirely.
import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { z } from "zod";
import { logOperationalError } from "@/build/services/operationalLog.server";

const MAX_BODY_BYTES = 4 * 1024;
const RATE_LIMIT_WINDOW_MIN = 60;
const RATE_LIMIT_MAX = 8;
const MAX_ANSWER_WORDS = 80;
const RATE_LIMIT_ACTION = "faq_ask";

const bodySchema = z.object({
  question: z.string().trim().min(1).max(500),
});

const FALLBACK_ANSWER =
  "Sorry, we couldn't answer that right now. Please reach out to our team and we'll help directly.";
const TOO_MANY_REQUESTS_ANSWER =
  "You've asked a few questions already — please try again in a bit, or contact our team directly.";

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? request.headers.get("cf-connecting-ip") ?? "unknown";
}

function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? "metre-build-ai";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/** Hard backstop — the system prompt asks for ~2-4 sentences, but a model can drift, so length is enforced in code rather than trusted to the model alone. */
export function truncateToWords(text: string, maxWords: number): string {
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/);
  if (words.length <= maxWords) return trimmed;
  return `${words.slice(0, maxWords).join(" ")}…`;
}

/**
 * Everything except body parsing and rate limiting — the part worth unit
 * testing in isolation. Never throws: an agent failure or an unexpected
 * error both resolve to the same generic fallback answer, never a raw
 * error message surfaced to an anonymous visitor.
 */
export async function answerFaqRequest(question: string): Promise<{ answer: string }> {
  try {
    const { answerFaqQuestion } = await import("@/build/ai/faqAssistant");
    const result = await answerFaqQuestion(question);
    if (result.status !== "ok" || !result.data) {
      logOperationalError("faq-ask.agent-failed", result.error ?? "no data returned", {});
      return { answer: FALLBACK_ANSWER };
    }
    return { answer: truncateToWords(result.data.answer, MAX_ANSWER_WORDS) };
  } catch (err) {
    logOperationalError("faq-ask.unhandled-error", err, {});
    return { answer: FALLBACK_ANSWER };
  }
}

export const Route = createFileRoute("/api/public/faq-ask")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        if (raw.length > MAX_BODY_BYTES) return json(413, { error: "Payload too large" });

        let parsed;
        try {
          parsed = bodySchema.safeParse(JSON.parse(raw));
        } catch {
          return json(400, { error: "Invalid JSON" });
        }
        if (!parsed.success) return json(400, { error: "A question is required." });

        // Rate limiting is a cost-protection mechanism, not a security
        // boundary — if the rate-limit store itself is unreachable, fail
        // open (still answer the question) rather than surface a raw 500
        // to an anonymous visitor. The AI call below has its own,
        // independent fallback for its own failures.
        try {
          const ipHash = hashIp(clientIp(request));
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MIN * 60 * 1000).toISOString();
          const { count } = await supabaseAdmin
            .from("build_runtime_rate")
            .select("*", { count: "exact", head: true })
            .eq("ip_hash", ipHash)
            .gte("created_at", windowStart);
          if ((count ?? 0) >= RATE_LIMIT_MAX) {
            return json(200, { answer: TOO_MANY_REQUESTS_ANSWER });
          }
          await supabaseAdmin
            .from("build_runtime_rate")
            .insert({ ip_hash: ipHash, action: RATE_LIMIT_ACTION });
        } catch (err) {
          logOperationalError("faq-ask.rate-limit-unavailable", err, {});
        }

        return json(200, await answerFaqRequest(parsed.data.question));
      },
    },
  },
});
