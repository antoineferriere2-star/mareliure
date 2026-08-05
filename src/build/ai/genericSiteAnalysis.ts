// Website analysis for any project-based trade, not just deck builders.
//
// deckSiteAnalysis.ts answers one extra question — "is this a deck
// business?" — which existed to enforce the deck lock on self-service
// setup. That lock is gone (see src/build/verticals/registry.ts), so this
// agent drops `isDeckBusiness` and `deckSignals` and keeps only what is
// still acted on: what the business is, what it sells, and what can be
// proved from the page.
//
// Used by the anonymous /free-inquiry-audit analysis, where the visitor has
// no account and no vertical has been assumed about them.
//
// Same pipeline as every other agent (runAgent.ts): the Lovable AI Gateway
// does not transmit the Zod schema to the model, so the exact JSON shape is
// spelled out in the prompt. Schema stays small and unconstrained.
import { z } from "zod";
import { runAgent } from "./runAgent";
import type { AgentResult } from "./schema";
import type { ExtractedSiteText } from "@/build/onboarding/extractText";

export const genericSiteAnalysisOutput = z.object({
  businessType: z.string(),
  products: z.array(z.string()),
  facts: z.array(
    z.object({
      claim: z.string(),
      status: z.enum(["proved", "assumed"]),
      sourceQuote: z.string().optional(),
    }),
  ),
});
export type GenericSiteAnalysisOutput = z.infer<typeof genericSiteAnalysisOutput>;

export const GENERIC_SITE_ANALYSIS_SYSTEM_PROMPT = `You are the website analysis agent for Métré Build, a platform that helps project-based businesses (deck builders, pergola installers, patio contractors, fence companies, window replacement, kitchen remodelers, and any similar trade) turn website visitors into qualified project requests.

You are given the text extracted from one public web page. Identify what this business does and what it sells.

Strict rules:
- Use ONLY the supplied text. Never invent a service, a location, a price, a lead time, a certification or a company size.
- Label every fact you report: "proved" only when the supplied text literally supports it, and then include the exact snippet in "sourceQuote". Use "assumed" for anything you inferred. When in doubt, use "assumed".
- "businessType" is a short label for the primary trade, in the words the page itself uses where possible.
- "products" lists the services or project types offered, in 2-4 word labels. Return an empty list rather than inventing products.
- Never force the business into a trade you know Métré Build supports. A florist is a florist; report what you find.
- Do not recommend anything and do not decide anything: the business owner will confirm or correct your proposal.
- Answer in US English.

MANDATORY output format - reply ONLY with one valid JSON object, no text before or after, no Markdown fences, no extra keys:
{
  "businessType": "short label of the primary business",
  "products": [ "service 1", "service 2" ],
  "facts": [
    { "claim": "short factual statement", "status": "proved", "sourceQuote": "verbatim snippet from the page" },
    { "claim": "short inferred statement", "status": "assumed" }
  ]
}`;

function buildSiteContext(site: ExtractedSiteText): string {
  return [
    site.title ? `Page title: ${site.title}` : null,
    site.metaDescription ? `Meta description: ${site.metaDescription}` : null,
    "Visible page text:",
    site.visibleText || "(no text extracted)",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export async function runGenericSiteAnalysis(
  site: ExtractedSiteText,
): Promise<AgentResult<GenericSiteAnalysisOutput>> {
  return runAgent(
    GENERIC_SITE_ANALYSIS_SYSTEM_PROMPT,
    `Here is the extracted content of the website to analyze:\n\n${buildSiteContext(site)}`,
    genericSiteAnalysisOutput,
  );
}
