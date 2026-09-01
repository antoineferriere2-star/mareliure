// Deterministic safety net for the Hermes internal API.
//
// The AI Engine is the preferred path: it produces better site analyses and
// better Playbook drafts. But prospecting must never stop because the Lovable
// AI Gateway is missing a key, holds a placeholder, is rate-limited, or is
// momentarily unavailable. When that happens, Hermes falls back to these pure,
// deterministic builders so a funnel can still be created, generated and
// published — an admin reviews the draft afterwards, exactly as with an AI one.
import type { DeckSiteAnalysisOutput } from "@/build/ai/deckSiteAnalysis";
import type { ExtractedSiteText } from "@/build/onboarding/extractText";
import type { PlaybookDraft } from "@/build/onboarding/expandPlaybookDraft";

/**
 * Failures that mean "the AI Engine cannot answer at all right now" rather than
 * "the model answered something invalid". Missing/placeholder credentials,
 * auth rejections, credit or policy blocks, and gateway weather all qualify:
 * retrying inside the same run cannot fix them.
 */
export const AI_UNAVAILABLE_PATTERNS = [
  /missing lovable_api_key/i,
  /lovable_api_key/i,
  /api key/i,
  /placeholder/i,
  /unauthorized/i,
  /\b401\b/,
  /\b402\b/,
  /\b403\b/,
  /credit/i,
  /quota/i,
  /rate limit/i,
  /too many requests/i,
  /\b429\b/,
  /\b50[0234]\b/,
  /gateway/i,
  /timed? ?out/i,
  /timeout/i,
  /unavailable/i,
  /overloaded/i,
  /capacity/i,
  /fetch failed/i,
] as const;

export const HERMES_LOCAL_LOVABLE_API_KEY_PLACEHOLDER = "local-dev-placeholder-not-a-real-key";

export function hasUsableHermesAiKey(value = process.env.LOVABLE_API_KEY): boolean {
  const key = (value ?? "").trim();
  return Boolean(key && key !== HERMES_LOCAL_LOVABLE_API_KEY_PLACEHOLDER);
}

export function isAiUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (!message.trim()) return false;
  return AI_UNAVAILABLE_PATTERNS.some((pattern) => pattern.test(message));
}

const DECK_SIGNAL_WORDS = [
  "deck",
  "decking",
  "composite",
  "pergola",
  "patio",
  "porch",
  "railing",
  "outdoor living",
];

function sentenceCase(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Deterministic stand-in for runDeckSiteAnalysis: keyword signals from the
 * fetched page, plus the caller's own campaign context. Every claim it emits is
 * marked "assumed" — nothing here is model-verified.
 */
export function buildFallbackSiteAnalysis(
  site: ExtractedSiteText,
  context: { companyName?: string | null; vertical?: string | null; businessType?: string | null },
): DeckSiteAnalysisOutput {
  const haystack = [site.title, site.metaDescription, site.visibleText]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const deckSignals = DECK_SIGNAL_WORDS.filter((word) => haystack.includes(word));
  const vertical = context.vertical?.trim() || null;
  const businessType =
    context.businessType?.trim() ||
    vertical ||
    (deckSignals.length > 0 ? "Deck builder" : "Home improvement contractor");
  const product = vertical ? `${vertical} project` : deckSignals.length > 0 ? "Deck" : "Project";

  const facts: DeckSiteAnalysisOutput["facts"] = [];
  if (site.title) {
    facts.push({
      claim: `Website title: ${site.title}`,
      status: "assumed",
      sourceQuote: site.title,
    });
  }
  if (site.metaDescription) {
    facts.push({
      claim: `Website description: ${site.metaDescription}`,
      status: "assumed",
      sourceQuote: site.metaDescription,
    });
  }
  facts.push({
    claim: "Analysis produced without the AI Engine — review before sending to the prospect.",
    status: "assumed",
  });

  return {
    businessType: sentenceCase(businessType),
    isDeckBusiness: deckSignals.length > 0,
    deckSignals,
    products: [sentenceCase(product)],
    facts,
  };
}

/**
 * Deterministic stand-in for runPlaybookDraftGeneration. Mirrors the AI agent's
 * contract: US English, USD budgets, US customary units, no contact fields
 * (a standard contact step is appended downstream), only generatable types.
 */
export function buildFallbackPlaybookDraft(businessType: string, product: string): PlaybookDraft {
  const label = product.trim() || "project";
  return {
    steps: [
      {
        title: "Your project",
        why: `Understand what kind of ${label} the visitor has in mind.`,
        fields: [
          {
            label: "What best describes your project?",
            type: "single_choice",
            required: true,
            options: ["New build", "Replacement", "Repair or upgrade", "Not sure yet"],
          },
          {
            label: `Tell us about your ${label}`,
            type: "text",
            required: false,
          },
        ],
      },
      {
        title: "Size and location",
        why: "Size and site access drive the scope of the estimate.",
        fields: [
          { label: "Approximate size (square feet)", type: "number", required: false },
          { label: "Project address", type: "address", required: true },
        ],
      },
      {
        title: "Current situation",
        why: "Existing conditions change how much preparation work is needed.",
        fields: [
          {
            label: "What is on the site today?",
            type: "single_choice",
            required: false,
            options: [
              "Nothing yet",
              "Existing structure to keep",
              "Existing structure to remove",
              "Not sure",
            ],
          },
          { label: "Photos of the area", type: "photo", required: false },
        ],
      },
      {
        title: "Priorities",
        why: `Know what matters most before the first call with a ${businessType.toLowerCase()}.`,
        fields: [
          {
            label: "What matters most to you?",
            type: "multi_choice",
            required: false,
            options: ["Durability", "Low maintenance", "Design and looks", "Speed", "Lowest cost"],
          },
        ],
      },
      {
        title: "Budget and timing",
        why: "Qualify the request so the sales team can prioritize it.",
        fields: [
          {
            label: "Budget range",
            type: "budget",
            required: false,
            options: [
              "Under $5,000",
              "$5,000-$15,000",
              "$15,000-$40,000",
              "$40,000+",
              "Not sure yet",
            ],
          },
          {
            label: "When would you like to start?",
            type: "timeline",
            required: false,
            options: [
              "As soon as possible",
              "Within 3 months",
              "In 3 to 6 months",
              "Just exploring",
            ],
          },
        ],
      },
    ],
  };
}
