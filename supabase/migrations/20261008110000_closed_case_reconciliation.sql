-- La réparation déclenchée à la lecture ne rouvre ni ne réattribue un dossier annulé.
-- Verrou non bloquant compatible avec les invitations ; une clôture en cours est ignorée.
CREATE OR REPLACE FUNCTION public.marketplace_repair_workshop_referral_matches() RETURNS integer
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_count integer;
BEGIN
  INSERT INTO marketplace_case_matches(case_id,binder_id,state,invited_at)
  SELECT c.id,c.referred_binder_id,'invited',clock_timestamp()
  FROM marketplace_cases c JOIN marketplace_binders b ON b.id=c.referred_binder_id
  WHERE c.acquisition_origin IN ('BINDER_REFERRED','FINEBINDERY_PROFILE') AND b.status='approved'
    AND c.status<>'cancelled'
    AND NOT EXISTS(SELECT 1 FROM marketplace_case_matches m WHERE m.case_id=c.id AND m.binder_id=c.referred_binder_id)
  FOR KEY SHARE OF c SKIP LOCKED
  ON CONFLICT(case_id,binder_id) DO NOTHING;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.marketplace_repair_workshop_referral_matches() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_repair_workshop_referral_matches() TO service_role;
