// Generates the CONTENT of a draft Playbook (steps + fields) for a business
// type/product that has no matching published Playbook yet — the onboarding
// wizard's "no match" dead end. Deliberately outputs a much simpler shape
// than PlaybookSchema itself: src/build/onboarding/expandPlaybookDraft.ts
// deterministically expands it into a full valid schema, so the model only
// has to get a small, flat shape right (same Gateway limitation as every
// other agent — the Zod schema is never actually transmitted to it, so the
// exact JSON shape is spelled out in the prompt). The result is always
// saved as an unpublished draft — CLAUDE.md: the AI proposes, an admin must
// review, adjust and publish it before any visitor ever sees it.
import { z } from "zod";
import { runAgent } from "./runAgent";
import type { AgentResult } from "./schema";
import { GENERATABLE_FIELD_TYPES } from "@/build/onboarding/expandPlaybookDraft";

const draftFieldOutput = z.object({
  label: z.string(),
  type: z.enum(GENERATABLE_FIELD_TYPES),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
});

const draftStepOutput = z.object({
  title: z.string(),
  why: z.string(),
  fields: z.array(draftFieldOutput),
});

export const playbookDraftGenerationOutput = z.object({
  steps: z.array(draftStepOutput),
});
export type PlaybookDraftGenerationOutput = z.infer<typeof playbookDraftGenerationOutput>;

const NON_US_BUDGET_PATTERN =
  /€|\beur\b|\beuros?\b|\/\s*m(?:2|²)\b|\bm(?:2|²)\b|\bsqm\b|\bsq\.?\s*m\b/i;

export function validateUsMarketDraft(draft: PlaybookDraftGenerationOutput): string | null {
  for (const step of draft.steps) {
    for (const field of step.fields) {
      if (field.type !== "budget") continue;
      const invalid = field.options?.find((option) => NON_US_BUDGET_PATTERN.test(option));
      if (invalid) {
        return `Budget option "${invalid}" is not compatible with the US/USD market.`;
      }
    }
  }
  return null;
}

export const PLAYBOOK_DRAFT_GENERATION_SYSTEM_PROMPT = `You are the Métré Build Playbook generation agent. A Playbook captures the business expertise of a service company (construction, remodeling, skilled trades...): the steps and questions needed to qualify a project before the first sales call. No published Playbook matches the detected business/product yet, so you propose a plausible generic draft that the business will review and adjust.

Strict rules:
- Always write native US English, even if the source business/product is in another language.
- Use US market conventions only: USD for money, square feet/feet/inches for area and dimensions. Never use euros, EUR, m², sqm, meters, centimeters, or other non-US units.
- Propose 4 to 7 plausible steps for this business/product, each with 1 to 3 fields.
- Allowed field types ONLY: single_choice, multi_choice, text, number, budget, timeline, address, photo. Do not use any other type.
- For single_choice/multi_choice/timeline/budget, provide 3 to 5 plausible generic options. Budget options must be broad USD ranges such as "Under $1,000", "$1,000-$5,000", "$5,000-$15,000", "$15,000+", or "Not sure yet".
- Never invent exact prices, building codes, standards, permits, or certifications. Stay on generic ranges and labels.
- Never add name/email/phone/consent fields yourself; a standard contact step is added separately.
- Stay generic and reasonable: this is a starting point to adjust, not definitive trade expertise.

Required output format — answer ONLY with a valid JSON object, with no text before/after, no Markdown fences, and no extra keys:
{
  "steps": [
    {
      "title": "step title",
      "why": "why this step helps the sales team",
      "fields": [
        { "label": "field label", "type": "single_choice", "required": true, "options": ["Option 1", "Option 2"] }
      ]
    }
  ]
}
"options" is only relevant for single_choice/multi_choice/timeline/budget; omit it for text/number/address/photo.`;

export async function runPlaybookDraftGeneration(
  businessType: string,
  product: string,
): Promise<AgentResult<PlaybookDraftGenerationOutput>> {
  const result = await runAgent(
    PLAYBOOK_DRAFT_GENERATION_SYSTEM_PROMPT,
    `Business type: ${businessType}\nProduct / project type: ${product}`,
    playbookDraftGenerationOutput,
  );
  if (result.status === "error" || !result.data) return result;

  const marketError = validateUsMarketDraft(result.data);
  if (marketError) {
    return {
      status: "error",
      error: `${marketError} Regenerate the Playbook draft in native English with USD and US customary units.`,
    };
  }
  return result;
}
