/**
 * Shape stored in build_missions.proposal (Json, already exists in the DB —
 * see supabase/migrations, no new migration needed). Read today by
 * build-runtime.ts / MissionRuntime.tsx (currently only `intro`); the
 * onboarding wizard is the first writer. Every field is optional light
 * personalization — never business logic (that stays in the Playbook).
 */
import { z } from "zod";

export const missionProposalSchema = z.object({
  intro: z.string().max(500).optional(),
  confirmationText: z.string().max(500).optional(),
  logoUrl: z.string().url().optional(),
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide (format attendu : #RRGGBB).")
    .optional(),
  hideOptionalFields: z.boolean().optional(),
});
export type MissionProposal = z.infer<typeof missionProposalSchema>;
