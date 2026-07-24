// Orchestrates the four AI Engine agents against an already-generated
// ProjectBrief. Additive only — this module never touches or recomputes the
// deterministic Dossier content, it only produces AiInsights alongside it.
import { z, type ZodType } from "zod/v4";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, getAiModel } from "./client.server";
import type { BriefLine, ProjectBrief } from "@/build/schema/brief";
import type { BuildKnowledgeNote, BuildMissionSummary } from "@/build/types";
import {
  analysteOutput,
  redacteurOutput,
  technicienOutput,
  verificateurOutput,
  type AgentResult,
  type AiInsights,
} from "./schema";
import {
  ANALYSTE_SYSTEM_PROMPT,
  REDACTEUR_SYSTEM_PROMPT,
  TECHNICIEN_SYSTEM_PROMPT,
  VERIFICATEUR_SYSTEM_PROMPT,
} from "./prompts";

type MissionLike = Pick<BuildMissionSummary, "name" | "objective">;
type KnowledgeNoteLike = Pick<BuildKnowledgeNote, "title" | "content">;

function renderLines(lines: BriefLine[]): string {
  if (lines.length === 0) return "  (aucune)";
  return lines.map((l) => `  - ${l.label} : ${l.value} [source: ${l.source}]`).join("\n");
}

function renderBrief(mission: MissionLike, brief: ProjectBrief): string {
  return [
    `Mission : ${mission.name}`,
    mission.objective ? `Objectif : ${mission.objective}` : null,
    `Résumé du projet : ${brief.projectSummary}`,
    `Confiance actuelle (calcul déterministe) : ${brief.confidence.label} (${brief.confidence.score}/100)`,
    "",
    "Informations confirmées :",
    renderLines(brief.confirmedInformation),
    "",
    "Hypothèses et informations calculées :",
    renderLines(brief.assumptionsAndCalculated),
    "",
    "Contraintes :",
    renderLines(brief.constraints),
    "",
    "Budget et délai :",
    renderLines(brief.budgetAndTiming),
    "",
    "Informations manquantes :",
    renderLines(brief.missingInformation),
    "",
    `Action suggérée (déterministe) : ${brief.suggestedNextAction.value}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function renderKnowledgeNotes(notes: KnowledgeNoteLike[]): string {
  if (notes.length === 0) return "(aucune note de connaissance approuvée disponible)";
  return notes.map((n) => `### ${n.title}\n${n.content ?? "(sans contenu)"}`).join("\n\n");
}

async function runAgent<Schema extends ZodType>(
  systemPrompt: string,
  userMessage: string,
  outputSchema: Schema,
): Promise<AgentResult<z.infer<Schema>>> {
  try {
    const response = await anthropic.messages.parse({
      model: getAiModel(),
      max_tokens: 4096,
      system: systemPrompt,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: zodOutputFormat(outputSchema),
      },
      messages: [{ role: "user", content: userMessage }],
    });
    if (response.parsed_output == null) {
      return { status: "error", error: "Réponse IA non structurée (parsing échoué)." };
    }
    return { status: "ok", data: response.parsed_output };
  } catch (err) {
    return { status: "error", error: err instanceof Error ? err.message : "Erreur IA inconnue." };
  }
}

export async function runAiAnalysis(
  mission: MissionLike,
  brief: ProjectBrief,
  knowledgeNotes: KnowledgeNoteLike[],
): Promise<AiInsights> {
  const briefText = renderBrief(mission, brief);
  const knowledgeText = renderKnowledgeNotes(knowledgeNotes);

  // Each runAgent() call already catches its own failure into an
  // AgentResult, so a single agent erroring never rejects this Promise.all
  // or prevents the other three from returning a result.
  const [analyste, technicien, verificateur, redacteur] = await Promise.all([
    runAgent(ANALYSTE_SYSTEM_PROMPT, `Voici le Dossier Commercial à analyser :\n\n${briefText}`, analysteOutput),
    runAgent(
      TECHNICIEN_SYSTEM_PROMPT,
      `Voici le Dossier Commercial :\n\n${briefText}\n\nVoici les notes de connaissance approuvées disponibles :\n\n${knowledgeText}`,
      technicienOutput,
    ),
    runAgent(
      VERIFICATEUR_SYSTEM_PROMPT,
      `Voici le Dossier Commercial à vérifier :\n\n${briefText}`,
      verificateurOutput,
    ),
    runAgent(REDACTEUR_SYSTEM_PROMPT, `Voici le Dossier Commercial à synthétiser :\n\n${briefText}`, redacteurOutput),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    model: getAiModel(),
    analyste,
    technicien,
    verificateur,
    redacteur,
  };
}
