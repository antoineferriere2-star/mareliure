ALTER TABLE public.build_workspaces
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_status text;

CREATE INDEX IF NOT EXISTS idx_build_workspaces_stripe_customer
  ON public.build_workspaces (stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_build_workspaces_stripe_subscription
  ON public.build_workspaces (stripe_subscription_id);