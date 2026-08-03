-- Let a workspace publish more than one Project Intake.
--
-- build_workspace_onboarding.workspace_id was UNIQUE, which modelled the table
-- as "the workspace's one setup". Everything downstream was already
-- multi-Mission — publish_workspace_onboarding enforces the plan's
-- max_active_missions, build_missions has no per-workspace uniqueness, and the
-- portal already lists, pauses and embeds each Mission separately — so this
-- single constraint was the only reason Growth/Pro/Business delivered nothing
-- more than Launch.
--
-- Replaced by a partial unique index: at most one setup *in flight* per
-- workspace, and any number of published ones. The customer publishes an
-- Intake, then starts the next. Keeping the wizard single-threaded is what
-- makes this a contained change rather than a rewrite; the plan limit on how
-- many Intakes may be live at once is unchanged and still enforced in
-- publish_workspace_onboarding.
--
-- NOTE for the application layer: the dropped constraint was also what made
-- `.upsert({ workspace_id, ... })` resolve to an update in analyzeMySite.
-- That call site is rewritten in the same commit to look the in-flight row up
-- explicitly — without that, every analysis would insert a new row.

ALTER TABLE public.build_workspace_onboarding
  DROP CONSTRAINT IF EXISTS build_workspace_onboarding_workspace_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS build_workspace_onboarding_one_in_flight_uidx
  ON public.build_workspace_onboarding (workspace_id)
  WHERE status <> 'published';

-- Resuming and publishing both need "the current setup" and "the most recent
-- one" fast, per workspace.
CREATE INDEX IF NOT EXISTS build_workspace_onboarding_workspace_created_idx
  ON public.build_workspace_onboarding (workspace_id, created_at DESC);

COMMENT ON INDEX public.build_workspace_onboarding_one_in_flight_uidx IS
  'At most one unpublished setup per workspace. Published rows are unconstrained: each one produced a live Mission, and the plan caps how many may be active.';
