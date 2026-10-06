-- A personal-link customer chose the named workshop, not an Oppe offer.
-- Atomically retain that attribution, select its existing invitation and import
-- with the existing provenance-preserving procedure. No financial agreement is fabricated.
CREATE FUNCTION public.marketplace_binder_import_own_case(
  p_binder_id uuid,p_case_id uuid,p_actor uuid,p_contact_name text,p_contact_email text,p_contact_phone text,p_work_title text,p_work_description text
) RETURNS uuid LANGUAGE plpgsql SET search_path=public AS $$
DECLARE c marketplace_cases%ROWTYPE; v_work uuid;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM marketplace_binder_members WHERE binder_id=p_binder_id AND user_id=p_actor AND account_status='active')
    OR NOT EXISTS(SELECT 1 FROM marketplace_binders WHERE id=p_binder_id AND status='approved') THEN RAISE EXCEPTION 'active_approved_workshop_required'; END IF;
  SELECT * INTO c FROM marketplace_cases WHERE id=p_case_id FOR UPDATE;
  IF NOT FOUND OR c.commercial_origin IS DISTINCT FROM 'workshop_client' OR c.referred_binder_id IS DISTINCT FROM p_binder_id THEN RAISE EXCEPTION 'own_case_not_found'; END IF;
  IF NOT EXISTS(SELECT 1 FROM marketplace_case_matches WHERE case_id=p_case_id AND binder_id=p_binder_id AND state IN ('invited','selected'))
    OR EXISTS(SELECT 1 FROM marketplace_case_matches WHERE case_id=p_case_id AND binder_id<>p_binder_id AND state='selected') THEN RAISE EXCEPTION 'own_case_not_available'; END IF;
  SELECT id INTO v_work FROM marketplace_binder_works WHERE binder_id=p_binder_id AND case_id=p_case_id;
  IF FOUND THEN RETURN v_work; END IF;
  IF NOT marketplace_workshop_can_create(p_binder_id) THEN RAISE EXCEPTION 'workshop_subscription_required'; END IF;
  UPDATE marketplace_case_matches SET state='selected',selected_at=clock_timestamp() WHERE case_id=p_case_id AND binder_id=p_binder_id AND state='invited';
  v_work:=marketplace_binder_import_case(p_binder_id,p_case_id,p_contact_name,p_contact_email,p_contact_phone,p_work_title,p_work_description);
  INSERT INTO marketplace_events(case_id,binder_id,actor_user_id,event_type,metadata)
    VALUES(p_case_id,p_binder_id,p_actor,'workshop_own_case_imported',jsonb_build_object('work_id',v_work));
  RETURN v_work;
END $$;
REVOKE ALL ON FUNCTION public.marketplace_binder_import_own_case(uuid,uuid,uuid,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_binder_import_own_case(uuid,uuid,uuid,text,text,text,text,text) TO service_role;
