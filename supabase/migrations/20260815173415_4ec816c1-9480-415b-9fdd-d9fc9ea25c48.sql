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

CREATE INDEX IF NOT EXISTS build_workspaces_internal_sales_idx
  ON public.build_workspaces (id)
  WHERE workspace_type = 'internal_sales';

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