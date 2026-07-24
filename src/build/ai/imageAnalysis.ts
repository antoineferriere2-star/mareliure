// Vision analysis for the "start from a photo" intake mode: given an
// inspiration image (the visitor's own photo, a Pinterest/Instagram
// screenshot, a catalog picture...), proposes hypotheses about the project
// the visitor may want — style, materials, shape, notable elements — plus
// follow-up questions worth asking. Everything here is a hypothesis: the
// visitor always confirms or corrects it, and the result is stored with
// that provenance (schema/brief.ts's "image_hypothesis" source) until they
// do. Same pipeline as the other agents (runAgent.ts): the Lovable AI
// Gateway does not transmit the Zod schema to the model, so the exact JSON
// shape is spelled out in the prompt itself.
import { z } from "zod";
import { runVisionAgent } from "./runAgent";
import type { AgentResult } from "./schema";

export const imageAnalysisOutput = z.object({
  style: z.string().optional(),
  materials: z.array(z.string()),
  shape: z.string().optional(),
  elements: z.array(z.string()),
  suggestedQuestions: z.array(z.string()),
});
export type ImageAnalysisOutput = z.infer<typeof imageAnalysisOutput>;

export const IMAGE_ANALYSIS_SYSTEM_PROMPT = `Tu es l'agent d'analyse d'image de Métré Build, une plateforme qui aide des entreprises de construction/rénovation à qualifier un projet à partir d'une photo d'inspiration déposée par un visiteur (sa propre photo, une capture Pinterest/Instagram, une photo de catalogue...).

Ton rôle : décrire ce que tu crois reconnaître sur l'image pour aider le visiteur à exprimer son projet, sans jamais te substituer à lui.

Règles strictes :
- Tout ce que tu proposes est une HYPOTHÈSE à confirmer par le visiteur, jamais une donnée technique certaine.
- N'annonce JAMAIS de dimensions fiables, de prix, de faisabilité, de conformité réglementaire, une identification certaine de matériau, ou une solution technique définitive.
- N'invente rien qui ne soit pas visible ou raisonnablement déductible de l'image. Si tu n'es pas sûr d'une dimension (style, matériaux, forme, éléments), laisse-la vide plutôt que de deviner.
- Propose 2 à 4 questions de suivi pertinentes pour clarifier le projet à partir de ce que tu vois.
- Réponds en français, de façon concise.

Format de sortie OBLIGATOIRE — réponds UNIQUEMENT avec un objet JSON valide, sans texte avant/après, sans balises Markdown, sans clés supplémentaires :
{
  "style": "style perçu, optionnel",
  "materials": [ "matériau visible ou supposé", "..." ],
  "shape": "forme générale perçue, optionnel",
  "elements": [ "élément notable du projet", "..." ],
  "suggestedQuestions": [ "question pertinente à poser ensuite", "..." ]
}`;

export async function runImageAnalysis(
  image: { base64: string; mediaType: string },
  textContext?: string,
): Promise<AgentResult<ImageAnalysisOutput>> {
  const prompt = textContext
    ? `Voici l'image d'inspiration déposée par le visiteur. Contexte additionnel : ${textContext}`
    : "Voici l'image d'inspiration déposée par le visiteur.";
  return runVisionAgent(IMAGE_ANALYSIS_SYSTEM_PROMPT, prompt, image, imageAnalysisOutput);
}
