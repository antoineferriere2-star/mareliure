-- La clôture et son motif forment une seule transaction ; aucune suppression ni notification.
-- Les invitations/propositions prennent le verrou du dossier avant de tester l'état :
-- une sollicitation concurrente est soit visible avant la clôture, soit refusée après celle-ci.
CREATE FUNCTION public.marketplace_case_attachment_requires_open()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_status text;
BEGIN
  IF TG_OP='UPDATE' AND NEW.case_id IS NOT DISTINCT FROM OLD.case_id THEN RETURN NEW; END IF;
  SELECT status INTO v_status FROM marketplace_cases WHERE id=NEW.case_id FOR KEY SHARE;
  IF v_status='cancelled' THEN RAISE EXCEPTION 'case_cancelled' USING ERRCODE='check_violation'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER marketplace_case_matches_require_open
  BEFORE INSERT OR UPDATE OF case_id ON public.marketplace_case_matches
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_case_attachment_requires_open();
CREATE TRIGGER marketplace_commercial_proposals_require_open
  BEFORE INSERT OR UPDATE OF case_id ON public.marketplace_commercial_proposals
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_case_attachment_requires_open();

CREATE FUNCTION public.marketplace_close_case_without_follow_up(
  p_case_id uuid, p_actor_user_id uuid, p_reason text, p_expected_status text DEFAULT NULL
) RETURNS text LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_status text; v_reason text:=btrim(p_reason);
BEGIN
  -- L'application appelle avec l'admin authentifié, après assertAdmin.
  -- L'opérateur SQL propriétaire peut conserver un acteur NULL, sans usurper une session.
  IF p_actor_user_id IS NULL THEN
    IF session_user<>'postgres' THEN RAISE EXCEPTION 'admin_required' USING ERRCODE='insufficient_privilege'; END IF;
  ELSIF NOT EXISTS(SELECT 1 FROM user_roles WHERE user_id=p_actor_user_id AND role='admin') THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE='insufficient_privilege';
  END IF;
  IF v_reason IS NULL OR char_length(v_reason)<5 OR char_length(v_reason)>300 THEN RETURN 'invalid_reason'; END IF;
  SELECT status INTO v_status FROM marketplace_cases WHERE id=p_case_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF p_expected_status IS NOT NULL AND v_status IS DISTINCT FROM p_expected_status THEN RETURN 'changed'; END IF;
  IF v_status NOT IN ('under_review','pricing','matching') THEN RETURN 'not_closable'; END IF;
  IF EXISTS(SELECT 1 FROM marketplace_case_matches WHERE case_id=p_case_id)
    OR EXISTS(SELECT 1 FROM marketplace_commercial_proposals WHERE case_id=p_case_id) THEN RETURN 'engaged'; END IF;
  UPDATE marketplace_cases SET status='cancelled' WHERE id=p_case_id;
  INSERT INTO marketplace_events(case_id,actor_user_id,event_type,metadata)
    VALUES(p_case_id,p_actor_user_id,'case_closed_without_follow_up',jsonb_build_object(
      'reason',v_reason,'previous_status',v_status,
      'execution_source',CASE WHEN p_actor_user_id IS NULL THEN 'database_operator' ELSE 'admin_app' END));
  RETURN 'closed';
END $$;
REVOKE ALL ON FUNCTION public.marketplace_case_attachment_requires_open() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.marketplace_close_case_without_follow_up(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_close_case_without_follow_up(uuid,uuid,text,text) TO service_role;
