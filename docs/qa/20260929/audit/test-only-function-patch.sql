\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$ BEGIN
 IF current_user <> 'postgres' THEN RAISE EXCEPTION 'unexpected_role'; END IF;
 IF position('q.status=''sent''' in pg_get_functiondef('public.marketplace_own_quote_eligible(uuid,uuid)'::regprocedure))>0 THEN RAISE EXCEPTION 'already_patched_stop'; END IF;
END $$;
LOCK TABLE public.marketplace_binder_quotes IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE audit_preserved AS SELECT
 (SELECT md5(coalesce(jsonb_agg(to_jsonb(q) ORDER BY id)::text,'')) FROM marketplace_binder_quotes q WHERE status IN ('accepted','invoiced')) quotes,
 (SELECT md5(coalesce(jsonb_agg(to_jsonb(m) ORDER BY version)::text,'')) FROM supabase_migrations.schema_migrations m) history;
CREATE OR REPLACE FUNCTION public.marketplace_own_quote_eligible(p_quote uuid,p_binder uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM marketplace_binder_quotes q
    LEFT JOIN marketplace_binder_works w ON w.id=q.work_id AND w.binder_id=q.binder_id
    LEFT JOIN marketplace_binder_clients c ON c.id=q.client_id AND c.binder_id=q.binder_id
    WHERE q.id=p_quote AND q.binder_id=p_binder AND q.deposit_cents=0
    AND q.status='sent' AND q.valid_until >= (now() AT TIME ZONE 'Europe/Paris')::date
    AND ((q.work_id IS NOT NULL AND w.source='mon_client' AND w.case_id IS NULL)
      OR (q.work_id IS NULL AND c.origin='mon_client' AND c.origin_case_id IS NULL)))
$$;
CREATE OR REPLACE FUNCTION public.marketplace_require_own_agreement() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE a marketplace_own_client_agreements%ROWTYPE;
BEGIN
  IF NEW.status='accepted' AND (TG_OP='INSERT' OR OLD.status NOT IN ('accepted','invoiced'))
    AND NEW.payment_snapshot->>'circuit'='own_client'
    AND NEW.deposit_cents=0
    AND NEW.valid_until >= (now() AT TIME ZONE 'Europe/Paris')::date
    AND (TG_OP='INSERT' OR OLD.status='sent') THEN
    SELECT * INTO a FROM marketplace_own_client_agreements WHERE quote_id=NEW.id AND binder_id=NEW.binder_id;
    IF NOT FOUND OR a.terms->>'currency' IS DISTINCT FROM NEW.currency
      OR (a.terms->>'total_ttc_cents')::bigint IS DISTINCT FROM NEW.total_ttc_cents THEN RAISE EXCEPTION 'own_agreement_required'; END IF;
    NEW.payment_snapshot := NEW.payment_snapshot || jsonb_build_object('agreement_version','own-external-v1',
      'platform_fee_cents',0,'agreement_recorded_at',a.accepted_at,'acceptance_evidence',a.evidence);
  END IF;
  RETURN NEW;
END $$;
DO $$ DECLARE expected record; BEGIN SELECT * INTO expected FROM audit_preserved;
 IF expected.quotes IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(q) ORDER BY id)::text,'')) FROM marketplace_binder_quotes q WHERE status IN ('accepted','invoiced')) THEN RAISE EXCEPTION 'accepted_quotes_changed'; END IF;
 IF expected.history IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(m) ORDER BY version)::text,'')) FROM supabase_migrations.schema_migrations m) THEN RAISE EXCEPTION 'history_changed'; END IF;
END $$;
COMMIT;
SELECT 'test-only-functions-patched-history-and-accepted-quotes-preserved';
