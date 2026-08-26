ALTER TABLE public.build_missions
  ADD COLUMN IF NOT EXISTS branding JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.build_missions.branding IS
  'Frozen copy of build_workspace_onboarding.branding, taken at publish time. Empty object = published before branding was captured; readers fall back to defaults. Never updated in place — republishing is what changes it.';

UPDATE public.build_missions m
SET branding = o.branding
FROM public.build_workspace_onboarding o
WHERE o.id = m.source_onboarding_id
  AND m.branding = '{}'::jsonb
  AND o.branding IS NOT NULL
  AND o.branding <> '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.publish_workspace_onboarding(
  p_workspace_id UUID,
  p_playbook_id UUID,
  p_validated_draft_schema JSONB,
  p_published_by UUID,
  p_mission_name TEXT
)
RETURNS TABLE (
  mission_id UUID,
  playbook_version_id UUID,
  reused_existing BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_onboarding public.build_workspace_onboarding%ROWTYPE;
  v_playbook public.build_playbooks%ROWTYPE;
  v_workspace public.build_workspaces%ROWTYPE;
  v_existing_mission public.build_missions%ROWTYPE;
  v_active_count INTEGER;
  v_next_version_number INTEGER;
  v_version_id UUID;
  v_mission_id UUID;
  v_public_token TEXT;
  v_constraint TEXT;
BEGIN
  IF p_mission_name IS NULL OR btrim(p_mission_name) = '' THEN
    RAISE EXCEPTION 'Mission name is required.';
  END IF;

  SELECT *
    INTO v_onboarding
    FROM public.build_workspace_onboarding
    WHERE workspace_id = p_workspace_id
      AND status <> 'published'
    FOR UPDATE;

  IF NOT FOUND THEN
    SELECT *
      INTO v_onboarding
      FROM public.build_workspace_onboarding
      WHERE workspace_id = p_workspace_id
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Start your setup first.';
  END IF;

  IF v_onboarding.status = 'published' AND v_onboarding.mission_id IS NOT NULL THEN
    SELECT *
      INTO v_existing_mission
      FROM public.build_missions
      WHERE id = v_onboarding.mission_id
        AND workspace_id = p_workspace_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Published onboarding points to a missing Mission.';
    END IF;

    RETURN QUERY
      SELECT v_existing_mission.id, v_existing_mission.playbook_version_id, TRUE;
    RETURN;
  END IF;

  SELECT *
    INTO v_existing_mission
    FROM public.build_missions
    WHERE source_onboarding_id = v_onboarding.id
      AND workspace_id = p_workspace_id
    FOR UPDATE;

  IF FOUND THEN
    UPDATE public.build_workspace_onboarding
      SET status = 'published',
          mission_id = v_existing_mission.id
      WHERE id = v_onboarding.id;

    RETURN QUERY
      SELECT v_existing_mission.id, v_existing_mission.playbook_version_id, TRUE;
    RETURN;
  END IF;

  IF v_onboarding.playbook_id IS NULL THEN
    RAISE EXCEPTION 'Generate your project intake draft first.';
  END IF;

  IF v_onboarding.playbook_id <> p_playbook_id THEN
    RAISE EXCEPTION 'Your draft changed while publishing. Review it and publish again.';
  END IF;

  SELECT *
    INTO v_playbook
    FROM public.build_playbooks
    WHERE id = v_onboarding.playbook_id
    FOR UPDATE;

  IF NOT FOUND OR v_playbook.workspace_id IS DISTINCT FROM p_workspace_id THEN
    RAISE EXCEPTION 'No draft to publish.';
  END IF;

  IF v_playbook.draft_schema <> p_validated_draft_schema THEN
    RAISE EXCEPTION 'Your draft changed while publishing. Review it and publish again.';
  END IF;

  SELECT *
    INTO v_workspace
    FROM public.build_workspaces
    WHERE id = p_workspace_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace not found.';
  END IF;

  SELECT count(*)
    INTO v_active_count
    FROM public.build_missions
    WHERE workspace_id = p_workspace_id
      AND status = 'active';

  IF v_active_count >= v_workspace.max_active_missions THEN
    RAISE EXCEPTION 'Your plan''s active Mission limit (%) is already reached. Pause another Mission first, or upgrade your plan.',
      v_workspace.max_active_missions;
  END IF;

  SELECT COALESCE(max(version_number), 0) + 1
    INTO v_next_version_number
    FROM public.build_playbook_versions
    WHERE playbook_id = v_playbook.id;

  INSERT INTO public.build_playbook_versions (
    playbook_id,
    version_number,
    schema,
    published_by
  )
  VALUES (
    v_playbook.id,
    v_next_version_number,
    p_validated_draft_schema,
    p_published_by
  )
  RETURNING id INTO v_version_id;

  UPDATE public.build_playbooks
    SET published_version_id = v_version_id,
        is_active = TRUE
    WHERE id = v_playbook.id;

  LOOP
    v_public_token := replace(gen_random_uuid()::text, '-', '');
    BEGIN
      INSERT INTO public.build_missions (
        name,
        workspace_id,
        playbook_id,
        playbook_version_id,
        playbook_name,
        status,
        public_token,
        published_at,
        source_onboarding_id,
        branding
      )
      VALUES (
        btrim(p_mission_name),
        p_workspace_id,
        v_playbook.id,
        v_version_id,
        v_playbook.name,
        'active',
        v_public_token,
        now(),
        v_onboarding.id,
        COALESCE(v_onboarding.branding, '{}'::jsonb)
      )
      RETURNING id INTO v_mission_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      IF v_constraint = 'build_missions_public_token_uidx' THEN
        CONTINUE;
      END IF;
      RAISE;
    END;
  END LOOP;

  UPDATE public.build_workspace_onboarding
    SET status = 'published',
        mission_id = v_mission_id
    WHERE id = v_onboarding.id;

  RETURN QUERY
    SELECT v_mission_id, v_version_id, FALSE;
END;
$$;