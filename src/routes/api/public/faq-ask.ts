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

type FaqLocale = "en-US" | "es-US";

const bodySchema = z.object({
  question: z.string().trim().min(1).max(500),
  locale: z.enum(["en-US", "es-US"]).default("en-US"),
});

const FALLBACK_ANSWER: Record<FaqLocale, string> = {
  "en-US":
    "Sorry, we couldn't answer that right now. Please reach out to our team and we'll help directly.",
  "es-US":
    "Lo sentimos, no pudimos responder eso en este momento. Contacte a nuestro equipo y le ayudaremos directamente.",
};
// Exact copy requested by the product audit — distinct from FALLBACK_ANSWER
// (an AI/infra failure) since this is a policy limit, not an error.
const TOO_MANY_REQUESTS_ANSWER: Record<FaqLocale, string> = {
  "en-US":
    "You've reached the question limit for this session. You can continue by email or review the full FAQ.",
  "es-US":
    "Alcanzó el límite de preguntas para esta sesión. Puede continuar por correo electrónico o revisar todas las preguntas frecuentes.",
};
const ONE_QUESTION_REMAINING_NOTICE: Record<FaqLocale, string> = {
  "en-US": "You have 1 question remaining in this session.",
  "es-US": "Le queda 1 pregunta en esta sesión.",
};

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
 * error message surfaced to an anonymous visitor. `usedFallback` tells the
 * caller whether this was a real, billable AI answer — the route handler
 * uses it to decide whether this attempt should count against the
 * visitor's question quota (a failed/fallback attempt never should).
 */
export async function answerFaqRequest(
  question: string,
  locale: FaqLocale = "en-US",
): Promise<{ answer: string; usedFallback: boolean }> {
  try {
    const { answerFaqQuestion } = await import("@/build/ai/faqAssistant");
    const result = await answerFaqQuestion(question);
    if (result.status !== "ok" || !result.data) {
      logOperationalError("faq-ask.agent-failed", result.error ?? "no data returned", {});
      return { answer: FALLBACK_ANSWER[locale], usedFallback: true };
    }
    return {
      answer: truncateToWords(result.data.answer, MAX_ANSWER_WORDS),
      usedFallback: false,
    };
  } catch (err) {
    logOperationalError("faq-ask.unhandled-error", err, {});
    return { answer: FALLBACK_ANSWER[locale], usedFallback: true };
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
        const { question, locale } = parsed.data;

        // Rate limiting is a cost-protection mechanism, not a security
        // boundary — if the rate-limit store itself is unreachable, fail
        // open (still answer the question) rather than surface a raw 500
        // to an anonymous visitor.
        const ipHash = hashIp(clientIp(request));
        let usedBeforeThisRequest = 0;
        let alreadyAtLimit = false;
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const windowStart = new Date(
            Date.now() - RATE_LIMIT_WINDOW_MIN * 60 * 1000,
          ).toISOString();
          const { count } = await supabaseAdmin
            .from("build_runtime_rate")
            .select("*", { count: "exact", head: true })
            .eq("ip_hash", ipHash)
            .gte("created_at", windowStart);
          usedBeforeThisRequest = count ?? 0;
          alreadyAtLimit = usedBeforeThisRequest >= RATE_LIMIT_MAX;
        } catch (err) {
          logOperationalError("faq-ask.rate-limit-unavailable", err, {});
        }

        if (alreadyAtLimit) {
          return json(200, { answer: TOO_MANY_REQUESTS_ANSWER[locale] });
        }

        const { answer, usedFallback } = await answerFaqRequest(question, locale);

        // Only a real, successfully-answered question counts against the
        // quota — an AI/infra failure (usedFallback) never should, since
        // that would let a degraded AI backend burn through a visitor's
        // entire question budget on failed attempts with nothing to show
        // for it.
        if (!usedFallback) {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            await supabaseAdmin
              .from("build_runtime_rate")
              .insert({ ip_hash: ipHash, action: RATE_LIMIT_ACTION });
          } catch (err) {
            logOperationalError("faq-ask.rate-limit-unavailable", err, {});
          }
        }

        // Surface "1 left" only right at the threshold — never an anxiety-
        // inducing running counter from the first question.
        const remainingAfterThis = RATE_LIMIT_MAX - usedBeforeThisRequest - 1;
        const notice =
          !usedFallback && remainingAfterThis === 1 ? ONE_QUESTION_REMAINING_NOTICE[locale] : null;

        return json(200, { answer, notice });
      },
    },
  },
});
