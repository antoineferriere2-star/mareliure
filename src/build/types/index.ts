/**
 * Shared TypeScript types for the Métré Build AI admin surface.
 * Types mirror the shape returned by `admin.data.functions.ts` and consumed
 * by `buildAdminClient` + `/build/*` pages.
 */
import type { PlaybookSchema } from "@/build/schema/playbook";

export type MissionStatus = "draft" | "active" | "paused" | "archived";

export interface BuildMissionSummary {
  id: string;
  name: string;
  status: MissionStatus | string;
  objective: string | null;
  playbook_id: string | null;
  playbook_name: string | null;
  playbook_version_id: string | null;
  /** Public runtime token exposed as `/m/:publicToken` */
  public_token: string | null;
  /** Revocation timestamp for the public token */
  public_token_revoked_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BuildDossierSummary {
  id: string;
  status: string;
  summary: string | null;
  mission_id: string | null;
  session_id: string | null;
  created_at: string;
  updated_at: string;
}

export type KnowledgeStatus = "proposed" | "approved" | "archived";

export interface BuildKnowledgeNote {
  id: string;
  title: string;
  content: string | null;
  tags: string[];
  status: KnowledgeStatus | string;
  created_at: string;
  updated_at: string;
}

export interface BuildPlaybookSummary {
  id: string;
  name: string;
  description: string | null;
  project_type: string | null;
  is_active: boolean;
  published_version_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BuildPlaybookVersionSummary {
  id: string;
  version_number: number;
  published_at: string;
}

export interface BuildPlaybookDetail extends BuildPlaybookSummary {
  draft_schema: PlaybookSchema;
  versions: BuildPlaybookVersionSummary[];
}

export type BuildDataSource = "supabase" | "local-fallback";
