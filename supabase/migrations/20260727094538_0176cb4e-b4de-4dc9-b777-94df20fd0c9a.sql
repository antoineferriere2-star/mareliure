ALTER TABLE public.build_workspace_onboarding
  ADD COLUMN IF NOT EXISTS mission_id UUID REFERENCES public.build_missions(id) ON DELETE SET NULL;