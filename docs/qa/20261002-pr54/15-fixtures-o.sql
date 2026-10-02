-- qwf, COMMIT. Dossiers fictifs identifiables RL-QA-O1..L5, clonés des dossiers QA RL-011 (MR) et RL-010 (FB).
-- Le clonage du dossier Build déclenche l'ingestion (marketplace_ingest_dossier) ; le dossier marketplace
-- ainsi créé reçoit ensuite les champs du dossier QA source. Atelier retenu : QA ATELIER B (approuvé).
-- Clients : comptes de test example.invalid. Aucun paiement réel.
DO $$
DECLARE src record; v_dossier uuid; v_case uuid; spec record; v_cols text;
BEGIN
  IF EXISTS (SELECT 1 FROM marketplace_cases WHERE reference LIKE 'RL-QA-O%') THEN RAISE EXCEPTION 'already_present'; END IF;
  SELECT string_agg(quote_ident(column_name), ',') INTO v_cols FROM information_schema.columns
    WHERE table_schema='public' AND table_name='marketplace_cases'
      AND column_name NOT IN ('id','dossier_id','brand','created_at','updated_at','reference','status','admin_notes','mission_id');
  FOR spec IN SELECT * FROM (VALUES
    ('RL-QA-O1','8c6505a5-8013-409c-b15f-17b79520745b'::uuid,'QA-O1 MR expédition organisée'),
    ('RL-QA-O2','8c6505a5-8013-409c-b15f-17b79520745b'::uuid,'QA-O2 MR remise en main propre'),
    ('RL-QA-O3','8c6505a5-8013-409c-b15f-17b79520745b'::uuid,'QA-O3 MR colis hors limites'),
    ('RL-QA-O4','dae7e3ed-6167-479f-a915-16eeda1013b3'::uuid,'QA-O4 FB expédition organisée'),
    ('RL-QA-O5','dae7e3ed-6167-479f-a915-16eeda1013b3'::uuid,'QA-O5 FB hors métropole')) AS t(ref, source, label)
  LOOP
    SELECT * INTO src FROM marketplace_cases WHERE id = spec.source;
    v_dossier := gen_random_uuid();
    EXECUTE format('INSERT INTO build_dossiers SELECT (jsonb_populate_record(NULL::build_dossiers, to_jsonb(d) || jsonb_build_object(''id'',%L::uuid,''session_id'',NULL,''created_at'',now(),''updated_at'',now()))).* FROM build_dossiers d WHERE d.id=%L', v_dossier, src.dossier_id);
    SELECT id INTO v_case FROM marketplace_cases WHERE dossier_id = v_dossier;
    IF v_case IS NULL THEN RAISE EXCEPTION 'ingest_missing'; END IF;
    IF (SELECT brand FROM marketplace_cases WHERE id=v_case) IS DISTINCT FROM src.brand THEN RAISE EXCEPTION 'brand_mismatch %', spec.ref; END IF;
    EXECUTE format('UPDATE marketplace_cases t SET (%s) = (SELECT %s FROM marketplace_cases s WHERE s.id=%L), reference=%L, status=''binder_selected'', admin_notes=%L WHERE t.id=%L',
      v_cols, v_cols, spec.source, spec.ref, spec.label || ' — dossier fictif de recette #54', v_case);
    INSERT INTO marketplace_case_matches(case_id,binder_id,state,binder_payout_cents,currency,invited_at,offered_at,responded_at,accepted_at,selected_at)
      SELECT v_case,binder_id,'selected',binder_payout_cents,currency,now(),now(),now(),now(),now() FROM marketplace_case_matches WHERE case_id=spec.source AND state='selected';
  END LOOP;
END $$;
SELECT jsonb_object_agg(reference, jsonb_build_object('id',id,'brand',brand,'customer',customer_user_id,'price',customer_price_cents,'pricing',pricing_status)) FROM marketplace_cases WHERE reference LIKE 'RL-QA-O%';
