-- Métré Sales / Demos: an internal workspace used to build real, personalised
-- demonstrations from a prospect's own website, without giving the sales agent
-- access to anything else in the product.
--
-- Deliberately small. Everything the workflow needs already exists — the
-- /portal/setup wizard (analyse -> confirm -> generate -> brand -> preview ->
-- publish), the public /m/:token URL, per-workspace RLS, per-workspace
-- notifications. What is missing is only the ability to say "this workspace is
-- ours, not a customer's" and "this demo is for that prospect".
--
-- Idempotent: safe to re-run.

-- 1. Telling an internal workspace apart from a customer's.
--
-- The alternative was to keep inferring it from `provisioned_for_user_id IS
-- NULL` (which resolveEntitlements already reads as "an operator created this
-- by hand"). That is true of Enterprise deals too, so it cannot answer "is this
-- ours?" — and a workspace whose billing exemption depends on a column staying
-- NULL breaks the day someone backfills it. An explicit type is checkable,
-- greppable and cannot be confused with a customer on a hand-made plan.
--
-- Never keyed on the workspace NAME: names are editable free text.
ALTER TABLE public.build_workspaces
  ADD COLUMN IF NOT EXISTS workspace_type TEXT NOT NULL DEFAULT 'client';

DO $$
BEGIN
  ALTER TABLE public.build_workspaces
    ADD CONSTRAINT build_workspaces_workspace_type_check
    CHECK (workspace_type IN ('client', 'internal_sales'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.build_workspaces.workspace_type IS
  'client (default, a paying customer) | internal_sales (Métré Sales / Demos: prospect demonstrations). internal_sales is billing-exempt and has no Stripe surface. Read through isInternalSalesWorkspace(), never by comparing the name.';

-- Partial index: the internal workspaces are a handful of rows among all
-- customers, and every "exclude demos from the business metrics" query filters
-- on exactly this.
CREATE INDEX IF NOT EXISTS build_workspaces_internal_sales_idx
  ON public.build_workspaces (id)
  WHERE workspace_type = 'internal_sales';

-- 2. Which prospect a demo is for.
--
-- One demo is one build_workspace_onboarding row (plus the Mission it
-- publishes). That row already carries site_url, final_url, the AI analysis,
-- the branding and created_by — so the prospect's website, the detected
-- business type and the author are stored today. Only two facts are missing.
--
-- prospect_domain is NOT stored: it is a pure function of final_url, and a
-- stored copy would be a second truth to keep in sync for no query we run.
ALTER TABLE public.build_workspace_onboarding
  ADD COLUMN IF NOT EXISTS prospect_company_name TEXT,
  ADD COLUMN IF NOT EXISTS prospect_status TEXT NOT NULL DEFAULT 'draft';

DO $$
BEGIN
  ALTER TABLE public.build_workspace_onboarding
    ADD CONSTRAINT build_workspace_onboarding_prospect_status_check
    CHECK (prospect_status IN ('draft', 'ready', 'sent', 'archived'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.build_workspace_onboarding.prospect_company_name IS
  'Prospect the demo is for. Only meaningful inside an internal_sales workspace; NULL on every customer setup.';

COMMENT ON COLUMN public.build_workspace_onboarding.prospect_status IS
  'draft (being built) | ready (published, link usable) | sent (link given to the prospect) | archived. Set to ready by publishMyDraft; sent and archived are the agent''s own markers.';
