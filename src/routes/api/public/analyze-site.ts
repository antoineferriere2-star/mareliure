// Anonymous website analysis for /free-inquiry-audit.
//
// A visitor pastes their URL and sees what the analysis agent finds, before
// creating any account. That is the point of the page: show the value first,
// ask for the account after. It also means an unauthenticated request can
// trigger a real LLM call and an outbound fetch to an arbitrary host, so the
// two costs are bounded here:
//
//   spend   5 analyses per hour per IP, counted from
//           build_public_site_analyses itself (the ledger and the rate-limit
//           store are the same table — one row per analysis, no double
//           bookkeeping).
//   reach   fetchSitePublicHtml does DNS resolution, private-range blocking,
//           redirect-chain limits and size/timeout caps. checkSiteUrl
//           rejects the obvious cases earlier with a clearer message.
//
// Unlike /portal/setup's analysis, nothing here is attached to a workspace:
// the visitor has no account yet, and no row is ever linked to one later.
import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { z } from "zod";
import { checkSiteUrl } from "@/build/onboarding/portalOnboarding";
import { logOperationalError } from "@/build/services/operationalLog.server";
import type { AgentResult } from "@/build/ai/schema";
import type { GenericSiteAnalysisOutput } from "@/build/ai/genericSiteAnalysis";

const MAX_BODY_BYTES = 4 * 1024;
const RATE_LIMIT_WINDOW_MIN = 60;
export const RATE_LIMIT_MAX = 5;

const bodySchema = z.object({
  url: z.string().trim().min(1).max(2048),
  // Client-generated. Lets a retry or a double-click resolve to the row that
  // already exists rather than paying for a second analysis.
  requestId: z.string().trim().min(8).max(64),
});

/** What the page renders. Deliberately the whole analysis and nothing more. */
export interface PublicSiteAnalysis {
  finalUrl: string;
  businessType: string;
  products: string[];
  facts: { claim: string; status: "proved" | "assumed"; sourceQuote?: string }[];
}

/**
 * Everything the handler needs from the outside world, injected so the
 * request logic can be tested without a database, an outbound fetch or a
 * billable model call — same reasoning as handleGetSummary in
 * project-summary.ts.
 */
/** The fluent subset of the Supabase builder this handler actually calls. */
interface SiteAnalysisQuery extends PromiseLike<{ count?: number | null; error: unknown }> {
  select(columns?: string, options?: { count?: "exact"; head?: boolean }): SiteAnalysisQuery;
  eq(column: string, value: unknown): SiteAnalysisQuery;
  gte(column: string, value: unknown): SiteAnalysisQuery;
  insert(row: Record<string, unknown>): SiteAnalysisQuery;
  update(patch: Record<string, unknown>): SiteAnalysisQuery;
  single(): Promise<{ data: { id: string } | null; error: unknown }>;
}

export interface AnalyzeSiteDeps {
  // Structurally typed rather than importing the client's full generic
  // signature, which does not survive being narrowed to one table.
  supabase: { from: (table: string) => SiteAnalysisQuery };
  fetchSite: (url: string) => Promise<{ finalUrl: string; html: string }>;
  analyze: (html: string) => Promise<AgentResult<GenericSiteAnalysisOutput>>;
}

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? request.headers.get("cf-connecting-ip") ?? "unknown";
}

/** Salted, like build_runtime_rate: recognising a repeat caller never requires keeping their address. */
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? "metre-build-ai";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

const UNAVAILABLE = "Website analysis is unavailable right now. Please try again shortly.";
const AI_FAILED = "The website analysis did not complete. You can run it again.";

export async function handleAnalyzeSite(
  deps: AnalyzeSiteDeps,
  request: Request,
): Promise<Response> {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: "Payload too large" });

  let parsed;
  try {
    parsed = bodySchema.safeParse(JSON.parse(raw));
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  if (!parsed.success) return json(400, { error: "Enter your website address." });

  const checked = checkSiteUrl(parsed.data.url);
  if (!checked.ok) return json(400, { error: checked.error });

  const ipHash = hashIp(clientIp(request));

  // Rate limiting here is spend protection, not a security boundary — but
  // unlike the FAQ widget it must NOT fail open: every request past this
  // point costs an LLM call plus an outbound fetch, so an unreachable
  // ledger is a reason to stop, not to wave traffic through.
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MIN * 60 * 1000).toISOString();
  let count: number | null | undefined;
  try {
    const result = await deps.supabase
      .from("build_public_site_analyses")
      .select("*", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", windowStart);
    if (result.error) throw result.error;
    count = result.count;
  } catch (err) {
    // Not just a returned `error`: the client itself throws when it cannot
    // be constructed (missing service-role key, for instance), and an
    // anonymous visitor must get this message rather than a stack trace.
    logOperationalError("analyze-site.rate-limit-unavailable", err, {});
    return json(503, { error: UNAVAILABLE });
  }
  if ((count ?? 0) >= RATE_LIMIT_MAX) {
    return json(429, {
      error: `You have run ${RATE_LIMIT_MAX} website analyses in the last hour. Try again later, or create an account to keep going.`,
    });
  }

  // Claiming the row before doing any work is what makes requestId
  // meaningful: a duplicate submission collides on the unique index instead
  // of starting a second, billable analysis.
  let claimed: { id: string } | null = null;
  let claimError: unknown = null;
  try {
    const result = await deps.supabase
      .from("build_public_site_analyses")
      .insert({
        ip_hash: ipHash,
        request_id: parsed.data.requestId,
        url: checked.url,
        status: "running",
      })
      .select("id")
      .single();
    claimed = result.data;
    claimError = result.error;
  } catch (err) {
    claimError = err;
  }

  if (claimError || !claimed) {
    // 23505 = this requestId is already in flight or already finished.
    if ((claimError as { code?: string } | null)?.code === "23505") {
      return json(409, { error: "That analysis is already running." });
    }
    logOperationalError("analyze-site.claim-failed", claimError, {});
    return json(503, { error: UNAVAILABLE });
  }

  const claimedId = claimed.id;
  const finish = async (status: "ok" | "error", fields: Record<string, unknown>) => {
    try {
      const { error } = await deps.supabase
        .from("build_public_site_analyses")
        .update({ status, ...fields })
        .eq("id", claimedId);
      if (error) logOperationalError("analyze-site.finish-failed", error, {});
    } catch (err) {
      // Bookkeeping must never cost the visitor the analysis they just paid
      // for with their wait.
      logOperationalError("analyze-site.finish-failed", err, {});
    }
  };

  let fetched: { finalUrl: string; html: string };
  try {
    fetched = await deps.fetchSite(checked.url);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unreachable";
    await finish("error", { error: `fetch: ${message}` });
    return json(400, {
      error: "We could not reach that website. Check the address and try again.",
    });
  }

  try {
    const result = await deps.analyze(fetched.html);
    if (result.status === "error" || !result.data) {
      await finish("error", { error: result.error ?? "unknown" });
      // Never a mocked fallback: an AI failure is reported as a failure, the
      // same rule the portal analysis follows.
      return json(502, { error: AI_FAILED });
    }

    const analysis: PublicSiteAnalysis = {
      finalUrl: fetched.finalUrl,
      businessType: result.data.businessType,
      products: result.data.products,
      facts: result.data.facts,
    };
    await finish("ok", { result: analysis });
    return json(200, { status: "ok", data: analysis });
  } catch (err) {
    logOperationalError("analyze-site.unhandled-error", err, {});
    await finish("error", { error: err instanceof Error ? err.message : "unknown" });
    return json(502, { error: AI_FAILED });
  }
}

export const Route = createFileRoute("/api/public/analyze-site")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const [
          { supabaseAdmin },
          { fetchSitePublicHtml },
          { extractSiteText },
          { runGenericSiteAnalysis },
        ] = await Promise.all([
          import("@/integrations/supabase/client.server"),
          import("@/build/onboarding/safeFetch.server"),
          import("@/build/onboarding/extractText"),
          import("@/build/ai/genericSiteAnalysis"),
        ]);

        return handleAnalyzeSite(
          {
            // The real client is generically typed per table; SiteAnalysisQuery
            // is the narrower shape this handler needs, and the two do not
            // unify structurally.
            supabase: supabaseAdmin as unknown as AnalyzeSiteDeps["supabase"],
            fetchSite: fetchSitePublicHtml,
            analyze: (html) => runGenericSiteAnalysis(extractSiteText(html)),
          },
          request,
        );
      },
    },
  },
});
