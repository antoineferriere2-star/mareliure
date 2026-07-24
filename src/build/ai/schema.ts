// Zod output schemas for the AI Engine's four agents. Kept small and flat
// (no .min/.max/pattern) so structured output works reliably across Gateway
// models — limits are stated in the prompts, not encoded in the schema.
import { z } from "zod";

export const findingSeverity = z.enum(["info", "warning", "critical"]);
export type FindingSeverity = z.infer<typeof findingSeverity>;

export const finding = z.object({
  label: z.string(),
  detail: z.string(),
  severity: findingSeverity,
});
export type Finding = z.infer<typeof finding>;

export const analysteOutput = z.object({
  summary: z.string(),
  findings: z.array(finding),
});
export type AnalysteOutput = z.infer<typeof analysteOutput>;

export const technicienOutput = z.object({
  summary: z.string(),
  findings: z.array(finding),
  knowledgeNoteTitlesUsed: z.array(z.string()),
});
export type TechnicienOutput = z.infer<typeof technicienOutput>;

export const verificateurOutput = z.object({
  summary: z.string(),
  findings: z.array(finding),
});
export type VerificateurOutput = z.infer<typeof verificateurOutput>;

export const redacteurOutput = z.object({
  narrative: z.string(),
});
export type RedacteurOutput = z.infer<typeof redacteurOutput>;

/** Per-agent result — an agent failure never blocks the other three. */
export interface AgentResult<T> {
  status: "ok" | "error";
  data?: T;
  error?: string;
}

/** Stored verbatim in build_dossiers.ai_insights. Always additive to the
 * deterministic ProjectBrief — never replaces or edits it. */
export interface AiInsights {
  generatedAt: string;
  model: string;
  analyste: AgentResult<AnalysteOutput>;
  technicien: AgentResult<TechnicienOutput>;
  verificateur: AgentResult<VerificateurOutput>;
  redacteur: AgentResult<RedacteurOutput>;
}
