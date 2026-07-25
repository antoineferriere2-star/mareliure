-- build_workspaces: one row per client business ("Espace Client"). Provisioned
-- by an admin only — no self-signup. Activates the workspace_id columns that
-- already exist (unused) on build_missions/build_playbooks/build_dossiers.
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

-- build_workspace_members: who can access a given workspace's portal.
CREATE TABLE public.build_workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.build_workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL, -- denormalized for admin display only, never used for auth
  role TEXT NOT NULL DEFAULT 'member', -- 'owner' | 'member'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
GRANT SELECT ON public.build_workspace_members TO authenticated;
GRANT ALL ON public.build_workspace_members TO service_role;
ALTER TABLE public.build_workspace_members ENABLE ROW LEVEL SECURITY;

-- Same carve-out as user_roles: a user may read their own membership rows
-- directly (used to gate /portal/* routes client-side), never anyone else's.
CREATE POLICY "Users can view their own workspace memberships"
  ON public.build_workspace_members FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX build_workspace_members_user_idx ON public.build_workspace_members(user_id);

-- Wire the existing dormant workspace_id columns to the new table.
-- (Playbooks stay unscoped: they are Métré Build's own methodology templates,
-- shared across clients — only Missions and their Dossiers belong to a workspace.)
ALTER TABLE public.build_missions
  ADD CONSTRAINT build_missions_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES public.build_workspaces(id) ON DELETE SET NULL;

ALTER TABLE public.build_dossiers
  ADD CONSTRAINT build_dossiers_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES public.build_workspaces(id) ON DELETE SET NULL;

CREATE INDEX build_missions_workspace_idx ON public.build_missions(workspace_id);
CREATE INDEX build_dossiers_workspace_idx ON public.build_dossiers(workspace_id);
