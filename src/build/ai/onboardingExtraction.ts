// AI extraction step for the onboarding wizard: given the text content of a
// client's public website, proposes a primary business type and the
// products/services it appears to offer. Every result here is a proposal —
// the client always confirms or corrects it in the wizard before anything
// is created (CLAUDE.md: "l'IA propose, ne décide jamais"). Same pipeline as
// the Dossier AI Agents (runAgent.ts): the Lovable AI Gateway does not
// transmit the Zod schema to Gemini, so the exact JSON shape is spelled out
// in the prompt itself.
import { z } from "zod";
import { runAgent } from "./runAgent";
import type { AgentResult } from "./schema";
import type { ExtractedSiteText } from "@/build/onboarding/extractText";

export const onboardingExtractionOutput = z.object({
  businessTypeCandidates: z.array(z.string()),
  products: z.array(z.string()),
});
export type OnboardingExtractionOutput = z.infer<typeof onboardingExtractionOutput>;

export const ONBOARDING_EXTRACTION_SYSTEM_PROMPT = `Tu es l'agent d'analyse de site de Métré Build, une plateforme qui aide des entreprises de services (construction, rénovation, aménagement...) à créer une Mission (un parcours guidé) pour leurs visiteurs.

Ton rôle : à partir du contenu textuel extrait d'un site web, identifier le métier principal de l'entreprise et les produits ou types de projets qu'elle propose.

Règles strictes :
- N'inclus QUE ce qui est explicitement présent ou clairement déductible du texte fourni. N'invente jamais un métier ou un produit absent du site.
- Si le texte ne permet pas d'identifier un métier avec certitude, propose plusieurs candidats plausibles plutôt qu'un seul choix arbitraire.
- Si aucun produit ou service n'est identifiable, renvoie une liste vide plutôt que d'en inventer.
- Tu proposes, tu ne décides jamais : le client confirmera ou corrigera ensuite.
- Réponds en français, avec des libellés courts (2 à 4 mots) pour chaque métier/produit.

Format de sortie OBLIGATOIRE — réponds UNIQUEMENT avec un objet JSON valide, sans texte avant/après, sans balises Markdown, sans clés supplémentaires :
{
  "businessTypeCandidates": [ "un ou plusieurs métiers plausibles, éventuellement un seul si évident" ],
  "products": [ "produit ou type de projet 1", "produit ou type de projet 2" ]
}`;

function buildSiteContext(site: ExtractedSiteText): string {
  return [
    site.title ? `Titre de la page : ${site.title}` : null,
    site.metaDescription ? `Description meta : ${site.metaDescription}` : null,
    "Texte visible de la page :",
    site.visibleText || "(aucun texte extrait)",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export async function runOnboardingExtraction(
  site: ExtractedSiteText,
): Promise<AgentResult<OnboardingExtractionOutput>> {
  const context = buildSiteContext(site);
  return runAgent(
    ONBOARDING_EXTRACTION_SYSTEM_PROMPT,
    `Voici le contenu extrait du site à analyser :\n\n${context}`,
    onboardingExtractionOutput,
  );
}
