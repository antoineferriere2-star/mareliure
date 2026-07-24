-- AI Engine output: admin-triggered analysis attached to an existing Dossier.
-- Always additive, never replaces the deterministic content produced by
-- generateProjectBrief() — the AI proposes, it never decides (CLAUDE.md).
-- NULL until an admin explicitly runs the analysis; no RLS change needed,
-- build_dossiers is already service_role-only.
ALTER TABLE public.build_dossiers
  ADD COLUMN ai_insights JSONB,
  ADD COLUMN ai_analyzed_at TIMESTAMPTZ;
