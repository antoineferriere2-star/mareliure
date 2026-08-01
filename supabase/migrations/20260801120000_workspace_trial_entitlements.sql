-- Local trial window for self-service signups.
--
-- Until now `subscription_status` was written by the Stripe webhook but read
-- by nobody, so a workspace kept full access with no subscription and after
-- cancellation. src/build/billing/entitlements.ts is the state machine that
-- closes that hole; this column supplies the one fact it cannot derive from
-- Stripe — when a signup that never subscribed stops being entitled.
--
-- Only meaningful for self-service rows (provisioned_for_user_id IS NOT NULL);
-- operator-created workspaces are never gated on it.

ALTER TABLE public.build_workspaces
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ
    DEFAULT (now() + INTERVAL '14 days');

-- Existing self-service workspaces get a fresh full window starting now,
-- rather than created_at + 14 days: back-dating would silently lock out
-- accounts that were legitimately using the product under the old (ungated)
-- rules the moment this deploys. Everyone gets the same notice period.
UPDATE public.build_workspaces
SET trial_ends_at = now() + INTERVAL '14 days'
WHERE provisioned_for_user_id IS NOT NULL
  AND trial_ends_at IS NULL;

-- Operator-created workspaces have no trial to speak of; leave the column
-- NULL so a stray value can never be mistaken for a gating signal.
UPDATE public.build_workspaces
SET trial_ends_at = NULL
WHERE provisioned_for_user_id IS NULL;

COMMENT ON COLUMN public.build_workspaces.trial_ends_at IS
  'End of the local pre-subscription trial for self-service signups. NULL for operator-created workspaces (never gated). Read only through resolveEntitlements().';
