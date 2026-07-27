ALTER TABLE public.build_workspaces
  ADD COLUMN IF NOT EXISTS provisioned_for_user_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS build_workspaces_provisioned_for_user_id_key
  ON public.build_workspaces (provisioned_for_user_id)
  WHERE provisioned_for_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS build_workspace_members_workspace_user_key
  ON public.build_workspace_members (workspace_id, user_id);

CREATE OR REPLACE FUNCTION public.provision_owner_workspace(
  _user_id uuid,
  _email text,
  _workspace_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _workspace_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  -- Already a member of at least one workspace: nothing to provision.
  SELECT workspace_id INTO _workspace_id
  FROM public.build_workspace_members
  WHERE user_id = _user_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF _workspace_id IS NOT NULL THEN
    RETURN _workspace_id;
  END IF;

  INSERT INTO public.build_workspaces (name, created_by, provisioned_for_user_id)
  VALUES (COALESCE(NULLIF(btrim(_workspace_name), ''), 'My Workspace'), _user_id, _user_id)
  ON CONFLICT (provisioned_for_user_id) DO NOTHING
  RETURNING id INTO _workspace_id;

  IF _workspace_id IS NULL THEN
    SELECT id INTO _workspace_id
    FROM public.build_workspaces
    WHERE provisioned_for_user_id = _user_id;
  END IF;

  INSERT INTO public.build_workspace_members (workspace_id, user_id, email, role)
  VALUES (_workspace_id, _user_id, COALESCE(_email, ''), 'owner')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  RETURN _workspace_id;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_owner_workspace(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.provision_owner_workspace(uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.provision_owner_workspace(uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.provision_owner_workspace(uuid, text, text) TO service_role;