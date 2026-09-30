-- No prices, balances, active Stripe subscriptions or issued documents are rewritten.
-- Deploy only after review; this migration is NOT applied to production by this PR.
CREATE TABLE public.marketplace_case_payment_circuits (
  case_id uuid PRIMARY KEY REFERENCES public.marketplace_cases(id) ON DELETE RESTRICT,
  circuit text NOT NULL CHECK (circuit IN ('own_client','network_sale','concierge','legacy_resale','review_required')),
  provenance jsonb NOT NULL,
  evidence_event_id uuid REFERENCES public.marketplace_events(id) ON DELETE RESTRICT,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  notes text NOT NULL DEFAULT ''
);
ALTER TABLE public.marketplace_case_payment_circuits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_case_payment_circuits FROM anon, authenticated;
GRANT ALL ON public.marketplace_case_payment_circuits TO service_role;

INSERT INTO public.marketplace_case_payment_circuits(case_id,circuit,provenance,notes)
SELECT c.id, CASE WHEN EXISTS (
  SELECT 1 FROM public.marketplace_commercial_proposals p WHERE p.case_id=c.id AND p.accepted_at IS NOT NULL
) THEN 'legacy_resale' ELSE 'review_required' END,
jsonb_build_object('acquisition_origin',c.acquisition_origin,'referred_binder_id',c.referred_binder_id,'recorded_case_id',c.id),
'Historical record: preserve accepted resale contracts; no commission inferred.'
FROM public.marketplace_cases c;

CREATE FUNCTION public.marketplace_seed_payment_circuit() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
  INSERT INTO public.marketplace_case_payment_circuits(case_id,circuit,provenance)
  VALUES (NEW.id,'review_required',jsonb_build_object('acquisition_origin',NEW.acquisition_origin,
    'referred_binder_id',NEW.referred_binder_id,'recorded_case_id',NEW.id));
  RETURN NEW;
END $$;
CREATE TRIGGER marketplace_seed_payment_circuit AFTER INSERT ON public.marketplace_cases
FOR EACH ROW EXECUTE FUNCTION public.marketplace_seed_payment_circuit();

CREATE FUNCTION public.marketplace_lock_payment_circuit() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
  -- Same parent lock as proposal creation/acceptance: no circuit/acceptance race.
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'payment_circuit_history_required'; END IF;
  PERFORM 1 FROM public.marketplace_cases WHERE id=OLD.case_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.marketplace_commercial_proposals WHERE case_id=OLD.case_id
      AND (accepted_at IS NOT NULL OR status='proposed')) OR EXISTS (
    SELECT 1 FROM public.marketplace_binder_quotes q
    LEFT JOIN public.marketplace_binder_works w ON w.id=q.work_id
    LEFT JOIN public.marketplace_binder_clients c ON c.id=q.client_id
    WHERE (q.payment_snapshot->'provenance'->>'recorded_case_id'=OLD.case_id::text
      OR w.case_id=OLD.case_id OR (q.work_id IS NULL AND c.origin_case_id=OLD.case_id))
      AND q.status IN ('accepted','invoiced')
  ) THEN
    RAISE EXCEPTION 'payment_circuit_locked_new_proposal_required';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER marketplace_lock_payment_circuit BEFORE UPDATE OR DELETE ON public.marketplace_case_payment_circuits
FOR EACH ROW EXECUTE FUNCTION public.marketplace_lock_payment_circuit();

CREATE FUNCTION public.marketplace_set_case_payment_circuit(p_case_id uuid,p_circuit text,p_event_id uuid,p_actor uuid,p_notes text)
RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_case public.marketplace_cases%ROWTYPE;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_actor AND role='admin') THEN RAISE EXCEPTION 'admin_required'; END IF;
  IF p_circuit IS NULL OR p_circuit NOT IN ('own_client','network_sale','concierge') OR length(btrim(coalesce(p_notes,'')))<12 THEN
    RAISE EXCEPTION 'circuit_and_evidence_required';
  END IF;
  SELECT * INTO v_case FROM public.marketplace_cases WHERE id=p_case_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'case_not_found'; END IF;
  IF p_event_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.marketplace_events WHERE id=p_event_id AND case_id=p_case_id) THEN
    RAISE EXCEPTION 'evidence_case_mismatch';
  END IF;
  UPDATE public.marketplace_case_payment_circuits SET circuit=p_circuit,evidence_event_id=p_event_id,
    reviewed_by=p_actor,reviewed_at=now(),notes=btrim(p_notes),
    provenance=jsonb_build_object('acquisition_origin',v_case.acquisition_origin,'referred_binder_id',v_case.referred_binder_id,
      'recorded_case_id',p_case_id,'evidence_event_id',p_event_id)
  WHERE case_id=p_case_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'circuit_not_found'; END IF;
  INSERT INTO public.marketplace_events(case_id,actor_user_id,event_type,metadata)
  VALUES(p_case_id,p_actor,'PAYMENT_CIRCUIT_REVIEWED',jsonb_build_object('circuit',p_circuit,'evidence_event_id',p_event_id,'notes',btrim(p_notes)));
END $$;
REVOKE ALL ON FUNCTION public.marketplace_set_case_payment_circuit(uuid,text,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_set_case_payment_circuit(uuid,text,uuid,uuid,text) TO service_role;

-- Existing accepted proposals retain their original merchant model. The historical resale
-- calculator MUST NOT produce a target-circuit contract with silently reinterpreted margin.
ALTER TABLE public.marketplace_commercial_proposals ADD COLUMN payment_circuit text NOT NULL DEFAULT 'legacy_resale',
  ADD COLUMN payment_provenance jsonb;
CREATE FUNCTION public.marketplace_snapshot_payment_circuit() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v public.marketplace_case_payment_circuits%ROWTYPE;
BEGIN
  IF TG_OP='UPDATE' AND OLD.accepted_at IS NOT NULL THEN
    IF NEW.payment_circuit IS DISTINCT FROM OLD.payment_circuit
      OR NEW.payment_provenance IS DISTINCT FROM OLD.payment_provenance THEN
      RAISE EXCEPTION 'accepted_payment_terms_immutable';
    END IF;
    RETURN NEW;
  END IF;
  PERFORM 1 FROM public.marketplace_cases WHERE id=NEW.case_id FOR UPDATE;
  SELECT * INTO v FROM public.marketplace_case_payment_circuits WHERE case_id=NEW.case_id;
  -- Dossier qualification is future intent, not an activated seller contract.
  -- Both brands still use the existing resale calculator and acceptance flow.
  -- A target contract requires a separate implementation/migration; classification
  -- alone must neither activate fees nor interrupt that existing flow.
  IF NEW.payment_circuit IS DISTINCT FROM 'legacy_resale' THEN
    RAISE EXCEPTION 'target_payment_contract_required';
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment_classification_missing'; END IF;
  NEW.payment_provenance := v.provenance || jsonb_build_object(
    'qualified_circuit',v.circuit,'contract_model','legacy_resale');
  RETURN NEW;
END $$;
CREATE TRIGGER marketplace_snapshot_payment_circuit BEFORE INSERT OR UPDATE ON public.marketplace_commercial_proposals
FOR EACH ROW EXECUTE FUNCTION public.marketplace_snapshot_payment_circuit();

-- Own-client quotes and imported dossiers remain distinguishable on the invoice.
-- Existing accepted quotes/issued invoices keep NULL (historical terms not reconstructed).
ALTER TABLE public.marketplace_binder_quotes ADD COLUMN payment_snapshot jsonb;
ALTER TABLE public.marketplace_binder_invoices ADD COLUMN payment_snapshot jsonb;
CREATE FUNCTION public.marketplace_quote_payment_snapshot() RETURNS trigger
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
CREATE TRIGGER marketplace_quote_payment_snapshot BEFORE INSERT OR UPDATE ON public.marketplace_binder_quotes
FOR EACH ROW EXECUTE FUNCTION public.marketplace_quote_payment_snapshot();

CREATE FUNCTION public.marketplace_invoice_payment_snapshot() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
  SELECT payment_snapshot INTO NEW.payment_snapshot FROM public.marketplace_binder_quotes
    WHERE id=NEW.quote_id AND binder_id=NEW.binder_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice_quote_binder_mismatch'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER marketplace_invoice_payment_snapshot BEFORE INSERT ON public.marketplace_binder_invoices
FOR EACH ROW EXECUTE FUNCTION public.marketplace_invoice_payment_snapshot();

CREATE FUNCTION public.marketplace_invoice_agreed_amount() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
  IF TG_OP='UPDATE' AND (NEW.payment_snapshot IS DISTINCT FROM OLD.payment_snapshot OR NEW.quote_id IS DISTINCT FROM OLD.quote_id) THEN
    RAISE EXCEPTION 'invoice_payment_terms_immutable';
  END IF;
  IF NEW.status='issued' AND NEW.payment_snapshot IS NOT NULL AND (
    (NEW.payment_snapshot->>'total_ttc_cents')::bigint IS DISTINCT FROM NEW.total_ttc_cents
    OR NEW.payment_snapshot->>'currency' IS DISTINCT FROM NEW.currency
    OR NEW.payment_snapshot->>'quote_id' IS DISTINCT FROM NEW.quote_id::text
  ) THEN RAISE EXCEPTION 'invoice_requires_new_agreed_quote'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER z_marketplace_invoice_agreed_amount BEFORE INSERT OR UPDATE ON public.marketplace_binder_invoices
FOR EACH ROW EXECUTE FUNCTION public.marketplace_invoice_agreed_amount();

-- A read-then-insert check is not sufficient for simultaneous session and intent events.
-- Preflight must inspect duplicates; do not delete historical rows to make this index pass.
CREATE UNIQUE INDEX marketplace_payment_success_once ON public.marketplace_events
  ((metadata->>'payment_intent_id')) WHERE event_type='CUSTOMER_PAYMENT_SUCCEEDED' AND metadata->>'payment_intent_id' IS NOT NULL;
