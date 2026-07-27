-- Atomic self-service onboarding publish.
--
-- This migration deliberately refuses to add the unique provenance guarantee
-- when existing data is already inconsistent. It never deletes or merges rows:
-- operators must inspect and repair the reported data first.

ALTER TABLE public.build_missions
  ADD COLUMN IF NOT EXISTS source_onboarding_id UUID;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.build_workspace_onboarding o
    LEFT JOIN public.build_missions m ON m.id = o.mission_id
    WHERE o.mission_id IS NOT NULL
      AND m.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot add onboarding publish provenance: an onboarding row references a missing Mission.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.build_workspace_onboarding o
    JOIN public.build_missions m ON m.id = o.mission_id
    WHERE o.mission_id IS NOT NULL
      AND m.workspace_id IS DISTINCT FROM o.workspace_id
  ) THEN
    RAISE EXCEPTION 'Cannot add onboarding publish provenance: an onboarding row references a Mission from another workspace.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.build_workspace_onboarding
    WHERE status = 'published'
      AND mission_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot add onboarding publish provenance: a published onboarding row has no Mission.';
  END IF;

  IF EXISTS (
    SELECT mission_id
    FROM public.build_workspace_onboarding
    WHERE mission_id IS NOT NULL
    GROUP BY mission_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add onboarding publish provenance: multiple onboarding rows reference the same Mission.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.build_workspace_onboarding o
    JOIN public.build_missions m ON m.id = o.mission_id
    WHERE m.source_onboarding_id IS NOT NULL
      AND m.source_onboarding_id <> o.id
  ) THEN
    RAISE EXCEPTION 'Cannot add onboarding publish provenance: a Mission is already linked to another onboarding row.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.build_missions m
    LEFT JOIN public.build_workspace_onboarding o ON o.id = m.source_onboarding_id
    WHERE m.source_onboarding_id IS NOT NULL
      AND o.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot add onboarding publish provenance: a Mission source_onboarding_id points to a missing onboarding row.';
  END IF;

  IF EXISTS (
    SELECT source_onboarding_id
    FROM public.build_missions
    WHERE source_onboarding_id IS NOT NULL
    GROUP BY source_onboarding_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add onboarding publish provenance: multiple Missions already share one onboarding provenance.';
  END IF;
END $$;

UPDATE public.build_missions m
SET source_onboarding_id = o.id
FROM public.build_workspace_onboarding o
WHERE o.mission_id = m.id
  AND m.source_onboarding_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'build_missions_source_onboarding_id_fkey'
      AND conrelid = 'public.build_missions'::regclass
  ) THEN
    ALTER TABLE public.build_missions
      ADD CONSTRAINT build_missions_source_onboarding_id_fkey
      FOREIGN KEY (source_onboarding_id)
      REFERENCES public.build_workspace_onboarding(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS build_missions_source_onboarding_uidx
  ON public.build_missions (source_onboarding_id)
  WHERE source_onboarding_id IS NOT NULL;

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
    FOR UPDATE;

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
        source_onboarding_id
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
        v_onboarding.id
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

REVOKE ALL ON FUNCTION public.publish_workspace_onboarding(UUID, UUID, JSONB, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_workspace_onboarding(UUID, UUID, JSONB, UUID, TEXT)
  TO service_role;
