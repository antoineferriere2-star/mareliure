// Admin-triggered audit of a public-request submitter's own website: what
// their current site does (or doesn't) do to capture project details before
// a first sales call — the exact promise made on the /free-inquiry-audit
// marketing page. Never a general design/SEO critique, and never a
// certainty about the business itself — only what's observable in the
// fetched page text. Same pipeline as the other agents (runAgent.ts): the
// Lovable AI Gateway does not transmit the Zod schema to the model, so the
// exact JSON shape is spelled out in the prompt itself.
import { z } from "zod";
import { runAgent } from "./runAgent";
import type { AgentResult } from "./schema";
import type { ExtractedSiteText } from "@/build/onboarding/extractText";

export const siteAuditFinding = z.object({
  label: z.string(),
  detail: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
});
export type SiteAuditFinding = z.infer<typeof siteAuditFinding>;

export const siteAuditOutput = z.object({
  summary: z.string(),
  strengths: z.array(z.string()),
  gaps: z.array(siteAuditFinding),
  suggestedNextSteps: z.array(z.string()),
});
export type SiteAuditOutput = z.infer<typeof siteAuditOutput>;

export const SITE_AUDIT_SYSTEM_PROMPT = `Tu es l'agent d'audit de site de Métré Build. Un visiteur a soumis une demande d'audit gratuit pour son propre site (entreprise de construction/rénovation/aménagement) — l'audit promis est précis : identifier ce que le parcours de contact actuel du site fait bien ou mal pour qualifier un projet AVANT le premier appel commercial.

Ton rôle : analyser le texte extrait du site fourni et évaluer uniquement son parcours de capture de demande/contact — jamais un jugement esthétique général, jamais le design, jamais le référencement.

Règles strictes :
- Base-toi UNIQUEMENT sur le texte fourni. N'invente rien qui ne soit pas observable.
- Ne prédis jamais un prix, un délai, une faisabilité ou un volume de trafic — ce ne sont pas des données visibles dans le texte d'une page.
- "gaps" = ce qui manque ou pourrait bloquer la qualification d'un projet avant l'appel (ex. pas de formulaire de contact visible dans le texte, aucune mention de délai de réponse, aucune question sur le budget ou le type de projet).
- "strengths" = ce que le site fait déjà bien pour ça.
- Si le texte ne permet pas de juger un aspect, ne l'invente pas — laisse la liste correspondante vide plutôt que de deviner.
- Réponds en français, de façon concise et actionnable pour un commercial qui va rappeler ce prospect.

Format de sortie OBLIGATOIRE — réponds UNIQUEMENT avec un objet JSON valide, sans texte avant/après, sans balises Markdown, sans clés supplémentaires :
{
  "summary": "1-3 phrases de synthèse",
  "strengths": [ "point fort du parcours actuel", "..." ],
  "gaps": [
    { "label": "titre court du manque", "detail": "explication", "severity": "info" }
  ],
  "suggestedNextSteps": [ "prochaine étape concrète suggérée", "..." ]
}
"severity" doit valoir exactement "info", "warning" ou "critical".`;

function buildAuditContext(site: ExtractedSiteText, requesterContext: string): string {
  return [
    requesterContext ? `Contexte de la demande : ${requesterContext}` : null,
    site.title ? `Titre de la page : ${site.title}` : null,
    site.metaDescription ? `Description meta : ${site.metaDescription}` : null,
    "Texte visible de la page :",
    site.visibleText || "(aucun texte extrait)",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export async function runSiteAudit(
  site: ExtractedSiteText,
  requesterContext = "",
): Promise<AgentResult<SiteAuditOutput>> {
  const context = buildAuditContext(site, requesterContext);
  return runAgent(SITE_AUDIT_SYSTEM_PROMPT, `Voici le site à auditer :\n\n${context}`, siteAuditOutput);
}
