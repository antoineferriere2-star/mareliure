-- Plan-based quotas per Espace Client (workspace). Defaults match the
-- Launch tier. `plan` only pre-fills these two columns in the admin UI when
-- picking a plan — enforcement always reads max_active_missions /
-- monthly_brief_quota directly off the row, never a hardcoded table, so
-- Enterprise deals and "extra active Mission" add-ons need no special case.
ALTER TABLE public.build_workspaces
  ADD COLUMN plan TEXT NOT NULL DEFAULT 'launch',
  -- 'launch' | 'growth' | 'pro' | 'business' | 'enterprise'
  ADD COLUMN max_active_missions INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN monthly_brief_quota INTEGER NOT NULL DEFAULT 50;

-- Speeds up the "Project Briefs this month" usage count.
CREATE INDEX build_dossiers_workspace_created_idx ON public.build_dossiers(workspace_id, created_at);
