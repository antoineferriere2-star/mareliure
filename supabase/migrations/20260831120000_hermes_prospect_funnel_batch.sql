-- Hermes prospect funnel batch runner.
--
-- A failed prospect demo must stay visible in the admin instead of blocking
-- the internal Sales / Demos workspace's single in-flight setup slot. Published
-- and failed rows are historical rows; every other status is still an active
-- setup and remains protected by the partial unique index.

ALTER TABLE public.build_workspace_onboarding
  ADD COLUMN IF NOT EXISTS prospect_campaign_id TEXT,
  ADD COLUMN IF NOT EXISTS prospect_request_id TEXT,
  ADD COLUMN IF NOT EXISTS prospect_last_step TEXT,
  ADD COLUMN IF NOT EXISTS prospect_last_error TEXT,
  ADD COLUMN IF NOT EXISTS prospect_last_error_at TIMESTAMPTZ;

DROP INDEX IF EXISTS public.build_workspace_onboarding_one_in_flight_uidx;

CREATE UNIQUE INDEX build_workspace_onboarding_one_in_flight_uidx
  ON public.build_workspace_onboarding (workspace_id)
  WHERE status NOT IN ('published', 'failed');

CREATE UNIQUE INDEX IF NOT EXISTS build_workspace_onboarding_prospect_request_uidx
  ON public.build_workspace_onboarding (workspace_id, prospect_request_id)
  WHERE prospect_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS build_workspace_onboarding_prospect_campaign_idx
  ON public.build_workspace_onboarding (workspace_id, prospect_campaign_id, created_at DESC)
  WHERE prospect_campaign_id IS NOT NULL;

COMMENT ON INDEX public.build_workspace_onboarding_one_in_flight_uidx IS
  'At most one active unpublished setup per workspace. Published and failed rows are history: a failed Hermes tunnel stays consultable without blocking the next prospect.';

COMMENT ON COLUMN public.build_workspace_onboarding.prospect_campaign_id IS
  'Optional non-personal campaign identifier supplied by Hermes for prospecting batches. Only meaningful in internal_sales workspaces.';

COMMENT ON COLUMN public.build_workspace_onboarding.prospect_request_id IS
  'Caller-supplied idempotency key for Hermes/admin prospect funnel creation. Unique per workspace when present.';

COMMENT ON COLUMN public.build_workspace_onboarding.prospect_last_step IS
  'Last Hermes batch step reached: create, analyze, confirm, generate, publish, or retry.';

COMMENT ON COLUMN public.build_workspace_onboarding.prospect_last_error IS
  'Last Hermes/admin batch error for this prospect funnel, truncated by the application.';

COMMENT ON COLUMN public.build_workspace_onboarding.prospect_last_error_at IS
  'When prospect_last_error was last written.';
