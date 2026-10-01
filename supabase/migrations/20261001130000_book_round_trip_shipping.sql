-- Inert until a new proposal explicitly opts in and a real rate is approved.
-- Historical accepted proposals keep shipping_offer_kind='manual'.
ALTER TABLE public.marketplace_commercial_proposals
  ADD COLUMN shipping_offer_kind text NOT NULL DEFAULT 'manual';
ALTER TABLE public.marketplace_commercial_proposals
  ADD CONSTRAINT marketplace_round_trip_offer_check CHECK (
    shipping_offer_kind = 'manual' OR (
      shipping_offer_kind = 'book_round_trip_fr'
      AND shipping_total_cents = 1250
      AND shipping_other_cents = 1250
      AND shipping_outbound_cents = 0
      AND shipping_return_cents = 0
      AND currency = 'EUR'
      AND payment_circuit = 'legacy_resale'
      AND deposit_type = 'NONE'
      AND (customer_vat_rate_bps IS NULL OR
        (customer_vat_rate_bps = 2000 AND tax_country = 'FR'))
      AND (accepted_at IS NULL OR
        (customer_vat_rate_bps = 2000 AND customer_total_ttc_cents IS NOT NULL))
    )
  );

-- Operator-reviewed evidence. No row means no purchasable transport.
-- Hashes identify validated private addresses without duplicating them here.
CREATE TABLE public.marketplace_round_trip_rate_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.marketplace_cases(id) ON DELETE RESTRICT,
  proposal_id uuid NOT NULL REFERENCES public.marketplace_commercial_proposals(id) ON DELETE RESTRICT,
  binder_id uuid NOT NULL REFERENCES public.marketplace_binders(id) ON DELETE RESTRICT,
  outbound_address_sha256 text NOT NULL CHECK (outbound_address_sha256 ~ '^[0-9a-f]{64}$'),
  return_address_sha256 text NOT NULL CHECK (return_address_sha256 ~ '^[0-9a-f]{64}$'),
  outbound_weight_grams integer NOT NULL CHECK (outbound_weight_grams BETWEEN 1 AND 500),
  return_weight_grams integer NOT NULL CHECK (return_weight_grams BETWEEN 1 AND 500),
  outbound_dimensions_mm integer[] NOT NULL,
  return_dimensions_mm integer[] NOT NULL,
  outbound_method text NOT NULL CHECK (length(btrim(outbound_method)) BETWEEN 3 AND 160),
  return_method text NOT NULL CHECK (length(btrim(return_method)) BETWEEN 3 AND 160),
  provider_quote_reference text NOT NULL CHECK (length(btrim(provider_quote_reference)) BETWEEN 3 AND 160),
  coverage_evidence_reference text NOT NULL CHECK (length(btrim(coverage_evidence_reference)) BETWEEN 3 AND 160),
  outbound_cost_ttc_cents integer NOT NULL CHECK (outbound_cost_ttc_cents > 0),
  return_cost_ttc_cents integer NOT NULL CHECK (return_cost_ttc_cents > 0),
  all_other_costs_ttc_cents integer NOT NULL CHECK (all_other_costs_ttc_cents >= 0),
  -- After recoverable VAT, carrier extras, packaging and allocated payment fees.
  -- 15 EUR TTC at 20% VAT produces only 12.50 EUR net revenue.
  estimated_economic_cost_cents integer NOT NULL CHECK (estimated_economic_cost_cents BETWEEN 0 AND 1250),
  economic_cost_evidence_reference text NOT NULL CHECK (length(btrim(economic_cost_evidence_reference)) BETWEEN 3 AND 160),
  valid_until timestamptz NOT NULL,
  reviewed_by uuid NOT NULL REFERENCES auth.users(id),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  return_ready_at timestamptz,
  return_ready_by uuid REFERENCES auth.users(id),
  CONSTRAINT round_trip_outbound_dimensions CHECK (
    array_length(outbound_dimensions_mm,1)=3 AND
    outbound_dimensions_mm[1] BETWEEN 1 AND 350 AND
    outbound_dimensions_mm[2] BETWEEN 1 AND 250 AND
    outbound_dimensions_mm[3] BETWEEN 1 AND 80),
  CONSTRAINT round_trip_return_dimensions CHECK (
    array_length(return_dimensions_mm,1)=3 AND
    return_dimensions_mm[1] BETWEEN 1 AND 350 AND
    return_dimensions_mm[2] BETWEEN 1 AND 250 AND
    return_dimensions_mm[3] BETWEEN 1 AND 80),
  CONSTRAINT round_trip_no_automatic_deficit CHECK (
    outbound_cost_ttc_cents + return_cost_ttc_cents + all_other_costs_ttc_cents <= 1500),
  UNIQUE (case_id, proposal_id)
);
ALTER TABLE public.marketplace_round_trip_rate_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_round_trip_rate_approvals FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE(return_ready_at,return_ready_by)
  ON public.marketplace_round_trip_rate_approvals TO service_role;

-- One reservation per leg. A lost provider response stays ambiguous, never
-- silently resets to a second purchase. Replacement requires separate review.
CREATE TABLE public.marketplace_round_trip_label_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.marketplace_cases(id) ON DELETE RESTRICT,
  proposal_id uuid NOT NULL REFERENCES public.marketplace_commercial_proposals(id) ON DELETE RESTRICT,
  rate_approval_id uuid NOT NULL REFERENCES public.marketplace_round_trip_rate_approvals(id) ON DELETE RESTRICT,
  binder_id uuid NOT NULL REFERENCES public.marketplace_binders(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('outbound','return')),
  status text NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed','ambiguous','confirmed','failed','cancelled')),
  stripe_payment_intent_id text NOT NULL,
  provider text,
  provider_label_id text,
  carrier text,
  tracking text,
  private_label_path text,
  charged_cost_ttc_cents integer CHECK (charged_cost_ttc_cents >= 0),
  refunded_cost_ttc_cents integer CHECK (refunded_cost_ttc_cents >= 0),
  cancelled_at timestamptz,
  provider_cancellation_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, direction),
  CONSTRAINT round_trip_confirmed_has_label CHECK (status <> 'confirmed' OR
    (provider_label_id IS NOT NULL AND carrier IS NOT NULL AND tracking IS NOT NULL AND private_label_path IS NOT NULL))
);
ALTER TABLE public.marketplace_round_trip_label_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_round_trip_label_jobs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.marketplace_round_trip_label_jobs TO service_role;
CREATE UNIQUE INDEX marketplace_round_trip_provider_label_uidx
  ON public.marketplace_round_trip_label_jobs(provider,provider_label_id)
  WHERE provider IS NOT NULL AND provider_label_id IS NOT NULL;

-- Append-only evidence for ambiguous responses, carrier updates, cancellation,
-- actual charges/refunds and operator recovery. Provider event IDs deduplicate
-- webhook redelivery; untrusted callbacks must be re-read from the provider.
CREATE TABLE public.marketplace_round_trip_label_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.marketplace_round_trip_label_jobs(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN
    ('request_started','response_ambiguous','label_confirmed','tracking_update',
     'purchase_failed','cancellation_requested','cancelled','unused','cost_adjusted','operator_note')),
  provider_event_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details)='object' AND length(details::text)<=4000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX marketplace_round_trip_label_events_provider_uidx
  ON public.marketplace_round_trip_label_events(job_id,provider_event_id)
  WHERE provider_event_id IS NOT NULL;
ALTER TABLE public.marketplace_round_trip_label_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_round_trip_label_events FROM anon,authenticated;
GRANT SELECT,INSERT ON public.marketplace_round_trip_label_events TO service_role;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('round-trip-labels-private','round-trip-labels-private',false,5242880,ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;
CREATE POLICY round_trip_labels_server_only ON storage.objects AS RESTRICTIVE
FOR ALL TO anon,authenticated USING(bucket_id <> 'round-trip-labels-private')
WITH CHECK(bucket_id <> 'round-trip-labels-private');

CREATE FUNCTION public.marketplace_mark_round_trip_return_ready(
  p_case uuid, p_binder uuid, p_actor uuid
) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_work uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.marketplace_binder_members WHERE binder_id=p_binder
    AND user_id=p_actor AND account_status='active') THEN RAISE EXCEPTION 'active_membership_required'; END IF;
  SELECT id INTO v_work FROM public.marketplace_binder_works
    WHERE case_id=p_case AND binder_id=p_binder FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'work_not_found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.marketplace_work_logistics_events
    WHERE work_id=v_work AND kind='received') THEN RAISE EXCEPTION 'physical_receipt_required'; END IF;
  UPDATE public.marketplace_round_trip_rate_approvals
    SET return_ready_at=coalesce(return_ready_at,now()),
        return_ready_by=coalesce(return_ready_by,p_actor)
    WHERE case_id=p_case AND binder_id=p_binder;
  IF NOT FOUND THEN RAISE EXCEPTION 'rate_approval_missing'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.marketplace_mark_round_trip_return_ready(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_mark_round_trip_return_ready(uuid,uuid,uuid) TO service_role;

CREATE FUNCTION public.marketplace_reserve_round_trip_label(
  p_case uuid, p_direction text, p_outbound_address_sha256 text, p_return_address_sha256 text
) RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_proposal public.marketplace_commercial_proposals%ROWTYPE;
  v_payment public.marketplace_commercial_proposal_payments%ROWTYPE;
  v_rate public.marketplace_round_trip_rate_approvals%ROWTYPE;
  v_binder uuid; v_work uuid; v_job public.marketplace_round_trip_label_jobs%ROWTYPE;
BEGIN
  IF p_direction NOT IN ('outbound','return') THEN RAISE EXCEPTION 'invalid_direction'; END IF;
  PERFORM 1 FROM public.marketplace_cases WHERE id=p_case FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'case_not_found'; END IF;
  SELECT * INTO v_proposal FROM public.marketplace_commercial_proposals
    WHERE case_id=p_case AND accepted_at IS NOT NULL FOR UPDATE;
  IF NOT FOUND OR v_proposal.shipping_offer_kind <> 'book_round_trip_fr'
    OR v_proposal.payment_circuit <> 'legacy_resale'
    OR v_proposal.status <> 'accepted' THEN RAISE EXCEPTION 'round_trip_offer_required'; END IF;
  SELECT * INTO v_payment FROM public.marketplace_commercial_proposal_payments
    WHERE proposal_id=v_proposal.id FOR UPDATE;
  IF NOT FOUND OR v_payment.paid_at IS NULL
    OR v_payment.stripe_checkout_session_id IS NULL
    OR v_payment.stripe_payment_intent_id IS NULL
    OR v_payment.amount_paid_cents IS DISTINCT FROM v_proposal.customer_total_ttc_cents
    OR lower(v_payment.paid_currency) IS DISTINCT FROM 'eur' THEN RAISE EXCEPTION 'platform_payment_required'; END IF;
  SELECT binder_id INTO v_binder FROM public.marketplace_case_matches
    WHERE case_id=p_case AND state='selected' AND accepted_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'accepted_workshop_required'; END IF;
  SELECT * INTO v_rate FROM public.marketplace_round_trip_rate_approvals
    WHERE case_id=p_case AND proposal_id=v_proposal.id AND binder_id=v_binder FOR UPDATE;
  IF NOT FOUND OR v_rate.valid_until <= now() THEN RAISE EXCEPTION 'current_rate_approval_required'; END IF;
  IF p_outbound_address_sha256 IS DISTINCT FROM v_rate.outbound_address_sha256
    OR p_return_address_sha256 IS DISTINCT FROM v_rate.return_address_sha256
    THEN RAISE EXCEPTION 'address_changed_review_required'; END IF;
  IF p_direction='return' THEN
    SELECT id INTO v_work FROM public.marketplace_binder_works
      WHERE case_id=p_case AND binder_id=v_binder FOR UPDATE;
    IF NOT FOUND OR v_rate.return_ready_at IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.marketplace_work_logistics_events
      WHERE work_id=v_work AND kind='received') THEN RAISE EXCEPTION 'return_not_ready'; END IF;
  END IF;
  INSERT INTO public.marketplace_round_trip_label_jobs AS j
    (case_id,proposal_id,rate_approval_id,binder_id,direction,stripe_payment_intent_id)
    VALUES (p_case,v_proposal.id,v_rate.id,v_binder,p_direction,v_payment.stripe_payment_intent_id)
    ON CONFLICT (case_id,direction) DO NOTHING RETURNING * INTO v_job;
  IF FOUND THEN RETURN jsonb_build_object('outcome','claim','id',v_job.id); END IF;
  SELECT * INTO v_job FROM public.marketplace_round_trip_label_jobs
    WHERE case_id=p_case AND direction=p_direction;
  IF v_job.proposal_id<>v_proposal.id OR v_job.stripe_payment_intent_id<>v_payment.stripe_payment_intent_id
    THEN RAISE EXCEPTION 'reservation_conflict'; END IF;
  RETURN jsonb_build_object('outcome',CASE WHEN v_job.status='confirmed' THEN 'existing' ELSE 'review_required' END,
    'id',v_job.id,'status',v_job.status);
END $$;
REVOKE ALL ON FUNCTION public.marketplace_reserve_round_trip_label(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_reserve_round_trip_label(uuid,text,text,text) TO service_role;
