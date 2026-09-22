-- Un dossier Ma Reliure retenu devient un ouvrage et un contact dans UNE transaction.
-- Les clients propres à l'atelier gardent leur origine ; aucune donnée existante n'est modifiée.
CREATE OR REPLACE FUNCTION public.marketplace_binder_import_case(
  p_binder_id UUID,
  p_case_id UUID,
  p_contact_name TEXT,
  p_contact_email TEXT,
  p_contact_phone TEXT,
  p_work_title TEXT,
  p_work_description TEXT
) RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_work_id UUID;
  v_contact_id UUID;
  v_reference TEXT;
BEGIN
  -- Sérialise les imports concurrents du même dossier. Le match doit rester sélectionné.
  PERFORM 1 FROM public.marketplace_cases c
    WHERE c.id = p_case_id AND c.brand = 'MA_RELIURE'
    FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.marketplace_case_matches m
    JOIN public.marketplace_binders b ON b.id = m.binder_id
    WHERE m.case_id = p_case_id AND m.binder_id = p_binder_id
      AND m.state = 'selected' AND b.status NOT IN ('suspended', 'rejected')
  ) THEN
    RAISE EXCEPTION 'case_not_selected_for_binder' USING ERRCODE = 'check_violation';
  END IF;

  SELECT id INTO v_work_id FROM public.marketplace_binder_works
    WHERE binder_id = p_binder_id AND case_id = p_case_id;
  IF FOUND THEN RETURN v_work_id; END IF;

  -- Un dossier ne crée qu'une fiche contact dans l'atelier, même si une ancienne tentative a
  -- laissé le contact sans ouvrage. Le verrou du dossier protège aussi ce chemin de la concurrence.
  SELECT id INTO v_contact_id FROM public.marketplace_binder_clients
    WHERE binder_id = p_binder_id AND origin_case_id = p_case_id
    ORDER BY created_at ASC LIMIT 1;

  IF length(btrim(coalesce(p_contact_name, ''))) NOT BETWEEN 1 AND 200
     OR length(btrim(coalesce(p_work_title, ''))) NOT BETWEEN 1 AND 300 THEN
    RAISE EXCEPTION 'invalid_case_import' USING ERRCODE = 'check_violation';
  END IF;

  IF v_contact_id IS NULL THEN
    INSERT INTO public.marketplace_binder_clients
      (binder_id, name, email, phone, origin, origin_case_id)
    VALUES (p_binder_id, btrim(p_contact_name), nullif(btrim(p_contact_email), ''),
            nullif(btrim(p_contact_phone), ''), 'ma_reliure', p_case_id)
    RETURNING id INTO v_contact_id;
  END IF;

  v_reference := public.marketplace_binder_next_work_reference(
    p_binder_id, EXTRACT(YEAR FROM now())::INTEGER
  );
  INSERT INTO public.marketplace_binder_works
    (binder_id, contact_id, reference, title, description, source, case_id)
  VALUES (p_binder_id, v_contact_id, v_reference, btrim(p_work_title),
          nullif(btrim(p_work_description), ''), 'ma_reliure', p_case_id)
  RETURNING id INTO v_work_id;

  RETURN v_work_id;
END;
$$;

REVOKE ALL ON FUNCTION public.marketplace_binder_import_case(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_binder_import_case(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO service_role;

-- Retour arrière, à n'exécuter qu'après vérification des dossiers importés :
-- DROP FUNCTION IF EXISTS public.marketplace_binder_import_case(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT);
