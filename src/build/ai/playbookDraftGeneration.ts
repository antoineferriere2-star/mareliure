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

export const PLAYBOOK_DRAFT_GENERATION_SYSTEM_PROMPT = `Tu es l'agent de génération de Playbook de Métré Build. Un Playbook porte l'expertise métier d'une entreprise de services (construction, rénovation, artisanat...) : les étapes et questions qui permettent de qualifier un projet avant le premier appel commercial. Aucun Playbook publié ne correspond au métier/produit détecté — tu proposes un brouillon générique plausible, que l'entreprise ajustera ensuite elle-même.

Règles strictes :
- Propose 4 à 7 étapes plausibles pour ce métier/produit, chacune avec 1 à 3 champs.
- Types de champ autorisés UNIQUEMENT : single_choice, multi_choice, text, number, budget, timeline, address, photo. N'utilise aucun autre type.
- Pour single_choice/multi_choice/timeline/budget, fournis 3 à 5 options plausibles et génériques (jamais de prix, norme ou certification inventés — reste sur des fourchettes ou des libellés généraux comme "Pas sûr").
- N'ajoute jamais toi-même de champ nom/email/téléphone/consentement — une étape de contact standard est déjà ajoutée séparément.
- Reste générique et raisonnable : c'est un point de départ à ajuster, pas une expertise métier définitive.
- Réponds en français si le métier/produit fourni sont en français, en anglais sinon.

Format de sortie OBLIGATOIRE — réponds UNIQUEMENT avec un objet JSON valide, sans texte avant/après, sans balises Markdown, sans clés supplémentaires :
{
  "steps": [
    {
      "title": "titre de l'étape",
      "why": "pourquoi cette étape est utile (aide au commercial)",
      "fields": [
        { "label": "libellé du champ", "type": "single_choice", "required": true, "options": ["Option 1", "Option 2"] }
      ]
    }
  ]
}
"options" n'est pertinent que pour single_choice/multi_choice/timeline/budget — omets-le pour text/number/address/photo.`;

export async function runPlaybookDraftGeneration(
  businessType: string,
  product: string,
): Promise<AgentResult<PlaybookDraftGenerationOutput>> {
  return runAgent(
    PLAYBOOK_DRAFT_GENERATION_SYSTEM_PROMPT,
    `Métier : ${businessType}\nProduit / type de projet : ${product}`,
    playbookDraftGenerationOutput,
  );
}
