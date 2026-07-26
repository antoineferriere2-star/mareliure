ALTER TABLE public.build_workspaces
  ADD COLUMN stripe_customer_id text,
  ADD COLUMN stripe_subscription_id text,
  ADD COLUMN subscription_status text;

CREATE UNIQUE INDEX build_workspaces_stripe_customer_id_idx
  ON public.build_workspaces (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
