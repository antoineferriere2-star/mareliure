/**
 * Shape stored in build_missions.proposal (Json, already exists in the DB —
 * see supabase/migrations, no new migration needed). Read today by
 * build-runtime.ts / MissionRuntime.tsx (currently only `intro`); the
 * onboarding wizard is the first writer. Every field is optional light
 * personalization — never business logic (that stays in the Playbook).
 */
import { z } from "zod";
import { SUPPORTED_LOCALES } from "@/build/i18n/locales";

export const missionProposalSchema = z.object({
  intro: z.string().max(500).optional(),
  /**
   * The language this Mission is written in.
   *
   * A generic capability, not a rule about any vertical: a Playbook authored in
   * French, Spanish or English says so here, and the runtime renders its own
   * chrome to match instead of leaving "Continue" and "Back" in the visitor's
   * stored site preference. Absent means "let the visitor choose", which is
   * every Mission that predates this field.
   *
   * Personalization, like everything else in this object — never business
   * logic, which stays in the Playbook.
   */
  defaultLocale: z.enum(SUPPORTED_LOCALES).optional(),
  confirmationText: z.string().max(500).optional(),
  logoUrl: z.string().url().optional(),
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide (format attendu : #RRGGBB).")
    .optional(),
  hideOptionalFields: z.boolean().optional(),
  /**
   * V1 configuration surface is deliberately this small: on/off, which
   * preview type, and a version number to key against future model
   * changes — no 3D editor, no per-field customization. Absent entirely
   * for every Mission that predates this feature (including every
   * existing seeded/published Mission), so old Missions never show a
   * preview they never opted into.
   */
  visualPreview: z
    .object({
      enabled: z.boolean(),
      type: z.literal("simple-deck-3d"),
      version: z.number().int().positive(),
    })
    .optional(),
});
export type MissionProposal = z.infer<typeof missionProposalSchema>;
