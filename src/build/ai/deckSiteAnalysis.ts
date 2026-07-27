// Client-facing site analysis for the self-service setup in /portal/setup.
// Distinct from the admin agent in onboardingExtraction.ts on three points
// the client flow actually requires: it answers in US English, it classifies
// whether the site is a deck business (the V1 vertical lock), and it labels
// every fact as proved (quoted from the page) or assumed (inference) so the
// UI can show provenance instead of presenting guesses as certainties.
//
// Same pipeline as every other agent (runAgent.ts): the Lovable AI Gateway
// does not transmit the Zod schema to the model, so the exact JSON shape is
// spelled out in the prompt. Schema stays small and unconstrained.
import { z } from "zod";
import { runAgent } from "./runAgent";
import type { AgentResult } from "./schema";
import type { ExtractedSiteText } from "@/build/onboarding/extractText";

export const deckSiteAnalysisOutput = z.object({
  businessType: z.string(),
  isDeckBusiness: z.boolean(),
  deckSignals: z.array(z.string()),
  products: z.array(z.string()),
  facts: z.array(
    z.object({
      claim: z.string(),
      status: z.enum(["proved", "assumed"]),
      sourceQuote: z.string().optional(),
    }),
  ),
});
export type DeckSiteAnalysisOutput = z.infer<typeof deckSiteAnalysisOutput>;

export const DECK_SITE_ANALYSIS_SYSTEM_PROMPT = `You are the website analysis agent for Métré Build, a platform that helps deck builders turn website visitors into qualified project requests.

You are given the text extracted from one public web page. Identify what this business does and whether it builds decks.

Strict rules:
- Use ONLY the supplied text. Never invent a service, a location, a price, a lead time, a certification or a company size.
- Label every fact you report: "proved" only when the supplied text literally supports it, and then include the exact snippet in "sourceQuote". Use "assumed" for anything you inferred. When in doubt, use "assumed".
- "isDeckBusiness" is true only when the text shows this company builds, installs, replaces or repairs decks, decking, or outdoor wood/composite platforms. A general contractor who never mentions decks is false.
- "deckSignals" lists the short phrases from the text that led to that judgement. Leave it empty when there are none.
- "products" lists the services or project types offered, in 2-4 word labels. Return an empty list rather than inventing products.
- Do not recommend anything and do not decide anything: the business owner will confirm or correct your proposal.
- Answer in US English.

MANDATORY output format - reply ONLY with one valid JSON object, no text before or after, no Markdown fences, no extra keys:
{
  "businessType": "short label of the primary business",
  "isDeckBusiness": true,
  "deckSignals": [ "phrase from the page" ],
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

export async function runDeckSiteAnalysis(
  site: ExtractedSiteText,
): Promise<AgentResult<DeckSiteAnalysisOutput>> {
  return runAgent(
    DECK_SITE_ANALYSIS_SYSTEM_PROMPT,
    `Here is the extracted content of the website to analyze:\n\n${buildSiteContext(site)}`,
    deckSiteAnalysisOutput,
  );
}
