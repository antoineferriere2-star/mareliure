-- Extend the existing external agreement to verified workshop referrals on either brand.
-- No accepted quote, issued invoice, stored origin, amount or historical snapshot is rewritten.
CREATE FUNCTION public.marketplace_binder_document_is_own_client(p_binder uuid,p_work uuid,p_client uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path=public AS $$
 SELECT CASE WHEN p_work IS NOT NULL THEN EXISTS(
   SELECT 1 FROM marketplace_binder_works w
   LEFT JOIN marketplace_binder_clients c ON c.id=p_client AND c.binder_id=p_binder
   LEFT JOIN marketplace_cases k ON k.id=w.case_id
   WHERE w.id=p_work AND w.binder_id=p_binder AND (
     (w.source='mon_client' AND w.case_id IS NULL)
     OR (w.source='workshop_platform' AND c.origin='workshop_platform'
       AND c.origin_case_id=w.case_id AND k.commercial_origin='workshop_client'
       AND k.referred_binder_id=p_binder)
   )
 ) ELSE EXISTS(
   SELECT 1 FROM marketplace_binder_clients c
   LEFT JOIN marketplace_cases k ON k.id=c.origin_case_id
   WHERE c.id=p_client AND c.binder_id=p_binder AND (
     (c.origin='mon_client' AND c.origin_case_id IS NULL)
     OR (c.origin='workshop_platform' AND k.commercial_origin='workshop_client'
       AND k.referred_binder_id=p_binder)
   )
 ) END;
$$;
REVOKE ALL ON FUNCTION public.marketplace_binder_document_is_own_client(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_binder_document_is_own_client(uuid,uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.marketplace_own_quote_eligible(p_quote uuid,p_binder uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM marketplace_binder_quotes q
    LEFT JOIN marketplace_binder_works w ON w.id=q.work_id AND w.binder_id=q.binder_id
    LEFT JOIN marketplace_binder_clients c ON c.id=q.client_id AND c.binder_id=q.binder_id
    WHERE q.id=p_quote AND q.binder_id=p_binder AND q.deposit_cents=0
    AND q.status='sent' AND q.valid_until >= (now() AT TIME ZONE 'Europe/Paris')::date
    AND marketplace_seller_entity(q.issuer) IS NOT NULL
    AND marketplace_binder_document_is_own_client(q.binder_id,q.work_id,q.client_id))
$$;

CREATE OR REPLACE FUNCTION public.marketplace_own_contract(p_quote uuid,p_binder uuid,p_actor uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE q marketplace_binder_quotes%ROWTYPE; v_applies boolean; v_required boolean; v_valid boolean;
BEGIN
  PERFORM marketplace_external_member(p_binder,p_actor);
  SELECT * INTO q FROM marketplace_binder_quotes WHERE id=p_quote AND binder_id=p_binder;
  IF NOT FOUND THEN RAISE EXCEPTION 'quote_not_found'; END IF;
  v_applies := q.deposit_cents=0 AND marketplace_binder_document_is_own_client(q.binder_id,q.work_id,q.client_id);
  v_valid := q.valid_until >= (now() AT TIME ZONE 'Europe/Paris')::date;
  v_required := v_applies AND q.status IN ('draft','sent','expired') AND (q.contract_epoch='external_v1' OR (q.status='sent' AND v_valid));
  RETURN jsonb_build_object('eligible',marketplace_own_quote_eligible(p_quote,p_binder),'version','own-external-v1','revision',md5(to_jsonb(q)::text),
    'seller',q.issuer,'currency',q.currency,'totalCents',q.total_ttc_cents,'feeCents',0,
    'evidence',(SELECT evidence FROM marketplace_own_client_agreements WHERE quote_id=q.id),
    'circuitApplies',v_applies,'agreementRequired',v_required,'contractEpoch',q.contract_epoch,
    'blocker',CASE WHEN NOT v_required THEN NULL
      WHEN marketplace_seller_entity(q.issuer) IS NULL THEN 'seller_identity_missing'
      WHEN NOT v_valid THEN 'validity_expired'
      WHEN q.status<>'sent' THEN 'send_first'
      ELSE NULL END);
END $$;

CREATE OR REPLACE FUNCTION public.marketplace_quote_payment_snapshot() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_case uuid; v_source text; v_circuit text; v_provenance jsonb;
BEGIN
  IF TG_OP='UPDATE' AND OLD.status IN ('accepted','invoiced') THEN
    IF (to_jsonb(NEW)-ARRAY['status','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','updated_at'])
      OR NEW.status NOT IN ('accepted','invoiced') OR (OLD.status='invoiced' AND NEW.status<>'invoiced') THEN
      RAISE EXCEPTION 'accepted_payment_terms_immutable';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.status <> 'accepted' THEN NEW.payment_snapshot := NULL; RETURN NEW; END IF;
  IF NEW.work_id IS NOT NULL THEN
    SELECT case_id,source INTO v_case,v_source FROM public.marketplace_binder_works
      WHERE id=NEW.work_id AND binder_id=NEW.binder_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'work_binder_mismatch'; END IF;
  ELSIF NEW.client_id IS NOT NULL THEN
    SELECT origin_case_id,origin INTO v_case,v_source FROM public.marketplace_binder_clients
      WHERE id=NEW.client_id AND binder_id=NEW.binder_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'client_binder_mismatch'; END IF;
  ELSE
    -- Free-form historical contact is a supported quote flow. Do not invent its origin.
    v_source := 'unverified_contact';
  END IF;
  IF v_case IS NOT NULL THEN
    PERFORM 1 FROM public.marketplace_cases WHERE id=v_case FOR UPDATE;
  END IF;
  IF marketplace_binder_document_is_own_client(NEW.binder_id,NEW.work_id,NEW.client_id) THEN
    v_circuit := 'own_client';
    v_provenance := jsonb_build_object('work_id',NEW.work_id,'client_id',NEW.client_id,'source',v_source,
      'recorded_case_id',v_case,'commercial_origin',CASE WHEN v_case IS NULL THEN NULL ELSE 'workshop_client' END);
  ELSIF v_source='workshop_platform' THEN
    RAISE EXCEPTION 'circuit_origin_mismatch';
  ELSIF v_case IS NOT NULL THEN
    PERFORM 1 FROM public.marketplace_cases WHERE id=v_case FOR UPDATE;
    SELECT circuit,provenance INTO v_circuit,v_provenance FROM public.marketplace_case_payment_circuits WHERE case_id=v_case;
  ELSE
    v_circuit := CASE WHEN v_source='mon_client' THEN 'own_client' ELSE 'review_required' END;
    v_provenance := jsonb_build_object('work_id',NEW.work_id,'client_id',NEW.client_id,'source',v_source);
  END IF;
  NEW.payment_snapshot := jsonb_build_object('version',1,'circuit',coalesce(v_circuit,'review_required'),
    'provenance',v_provenance,'currency',NEW.currency,'total_ttc_cents',NEW.total_ttc_cents,
    'quote_id',NEW.id,'collection','external','platform_fee_cents',NULL,'fee_basis',NULL);
  RETURN NEW;
END $$;
