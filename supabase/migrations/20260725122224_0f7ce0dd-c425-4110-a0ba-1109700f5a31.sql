-- 20260725070000_build_workspaces.sql
CREATE TABLE public.build_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.build_workspaces TO service_role;
ALTER TABLE public.build_workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access to build_workspaces"
  ON public.build_workspaces FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE TRIGGER build_workspaces_touch
  BEFORE UPDATE ON public.build_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.build_touch_updated_at();

CREATE TABLE public.build_workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.build_workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
GRANT SELECT ON public.build_workspace_members TO authenticated;
GRANT ALL ON public.build_workspace_members TO service_role;
ALTER TABLE public.build_workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own workspace memberships"
  ON public.build_workspace_members FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX build_workspace_members_user_idx ON public.build_workspace_members(user_id);

ALTER TABLE public.build_missions
  ADD CONSTRAINT build_missions_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES public.build_workspaces(id) ON DELETE SET NULL;

ALTER TABLE public.build_dossiers
  ADD CONSTRAINT build_dossiers_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES public.build_workspaces(id) ON DELETE SET NULL;

CREATE INDEX build_missions_workspace_idx ON public.build_missions(workspace_id);
CREATE INDEX build_dossiers_workspace_idx ON public.build_dossiers(workspace_id);

-- 20260725080000_dossier_followup.sql
ALTER TABLE public.build_dossiers
  ADD COLUMN commercial_status TEXT NOT NULL DEFAULT 'nouveau',
  ADD COLUMN commercial_notes TEXT,
  ADD COLUMN last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN assigned_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX build_dossiers_commercial_status_idx ON public.build_dossiers(commercial_status);