ALTER TABLE public.build_workspaces
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ
    DEFAULT (now() + INTERVAL '14 days');

UPDATE public.build_workspaces
SET trial_ends_at = now() + INTERVAL '14 days'
WHERE provisioned_for_user_id IS NOT NULL
  AND trial_ends_at IS NULL;

UPDATE public.build_workspaces
SET trial_ends_at = NULL
WHERE provisioned_for_user_id IS NULL;

COMMENT ON COLUMN public.build_workspaces.trial_ends_at IS
  'End of the local pre-subscription trial for self-service signups. NULL for operator-created workspaces (never gated). Read only through resolveEntitlements().';