-- Managed marketplace pricing and fixed-payout workshop offers.
-- The matching row keeps ranking/invitation facts. The quote row is the
-- managed offer shown to an atelier: Ma Reliure fixes both amounts and the
-- atelier only accepts or declines.

ALTER TABLE public.marketplace_cases
  ADD COLUMN pricing_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN suggested_customer_price_cents INTEGER,
  ADD COLUMN suggested_binder_payout_cents INTEGER,
  ADD COLUMN customer_price_cents INTEGER,
  ADD COLUMN binder_payout_cents INTEGER,
  ADD COLUMN pricing_currency TEXT NOT NULL DEFAULT 'EUR',
  ADD COLUMN pricing_confidence TEXT,
  ADD COLUMN pricing_reason_codes TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN pricing_rule_version TEXT,
  ADD COLUMN price_includes TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN pricing_generated_at TIMESTAMPTZ,
  ADD COLUMN pricing_validated_at TIMESTAMPTZ,
  ADD COLUMN pricing_validated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.marketplace_cases
  ADD CONSTRAINT marketplace_cases_pricing_status_check
    CHECK (pricing_status IN ('pending', 'suggested', 'validated')),
  ADD CONSTRAINT marketplace_cases_pricing_confidence_check
    CHECK (pricing_confidence IS NULL OR pricing_confidence IN ('low', 'medium', 'high')),
  ADD CONSTRAINT marketplace_cases_suggested_prices_check CHECK (
    suggested_customer_price_cents IS NULL
    OR (
      suggested_customer_price_cents > 0
      AND suggested_binder_payout_cents > 0
      AND suggested_binder_payout_cents <= suggested_customer_price_cents
    )
  ),
  ADD CONSTRAINT marketplace_cases_validated_prices_check CHECK (
    pricing_status <> 'validated'
    OR (
      customer_price_cents > 0
      AND binder_payout_cents > 0
      AND binder_payout_cents <= customer_price_cents
      AND pricing_validated_at IS NOT NULL
    )
  );

ALTER TABLE public.marketplace_cases DROP CONSTRAINT marketplace_cases_status_check;
ALTER TABLE public.marketplace_cases ADD CONSTRAINT marketplace_cases_status_check CHECK (status IN (
  'under_review', 'pricing', 'matching', 'awaiting_binder_response',
  'binder_accepted', 'binder_selected', 'awaiting_payment', 'paid',
  'shipping_to_binder', 'received_by_binder', 'in_progress',
  'awaiting_approval', 'shipping_to_customer', 'delivered', 'completed',
  'cancelled',
  -- Read-only compatibility for cases created before this migration.
  'sent_to_binders', 'quotes_received'
));

ALTER TABLE public.marketplace_case_matches
  ADD COLUMN binder_payout_cents INTEGER,
  ADD COLUMN currency TEXT NOT NULL DEFAULT 'EUR',
  ADD COLUMN offered_at TIMESTAMPTZ,
  ADD COLUMN expires_at TIMESTAMPTZ,
  ADD COLUMN accepted_at TIMESTAMPTZ,
  ADD COLUMN declined_at TIMESTAMPTZ,
  ADD COLUMN selected_at TIMESTAMPTZ,
  ADD COLUMN decline_reason_code TEXT,
  ADD COLUMN decline_reason_detail TEXT;

ALTER TABLE public.marketplace_case_matches
  ADD CONSTRAINT marketplace_case_matches_payout_check
    CHECK (binder_payout_cents IS NULL OR binder_payout_cents > 0),
  ADD CONSTRAINT marketplace_case_matches_decline_code_check CHECK (
    decline_reason_code IS NULL OR decline_reason_code IN (
      'payout_insufficient', 'deadline_impossible', 'outside_specialty',
      'no_capacity', 'other'
    )
  );

ALTER TABLE public.marketplace_case_matches
  DROP CONSTRAINT marketplace_case_matches_state_check;
ALTER TABLE public.marketplace_case_matches
  ADD CONSTRAINT marketplace_case_matches_state_check CHECK (state IN (
    'offered', 'accepted', 'declined', 'expired', 'cancelled', 'selected',
    -- Read-only compatibility for rows created before this migration.
    'invited', 'quoted'
  ));

CREATE INDEX marketplace_case_matches_offer_state_idx
  ON public.marketplace_case_matches(case_id, state);

-- A quote is now one managed offer per case/atelier. The descriptive fields
-- remain for historical rows and support, while the fixed price pair and the
-- response timestamps are the active contract.
ALTER TABLE public.marketplace_quotes
  ALTER COLUMN description DROP NOT NULL,
  ALTER COLUMN lead_time_weeks DROP NOT NULL,
  ADD COLUMN customer_price_cents INTEGER,
  ADD COLUMN binder_payout_cents INTEGER,
  ADD COLUMN offered_at TIMESTAMPTZ,
  ADD COLUMN expires_at TIMESTAMPTZ,
  ADD COLUMN accepted_at TIMESTAMPTZ,
  ADD COLUMN declined_at TIMESTAMPTZ,
  ADD COLUMN selected_at TIMESTAMPTZ,
  ADD COLUMN decline_reason_code TEXT,
  ADD COLUMN decline_reason_detail TEXT;

ALTER TABLE public.marketplace_quotes DROP CONSTRAINT marketplace_quotes_state_check;
ALTER TABLE public.marketplace_quotes
  ADD CONSTRAINT marketplace_quotes_state_check CHECK (state IN (
    'offered', 'accepted', 'declined', 'expired', 'cancelled', 'selected',
    -- Read-only compatibility for rows created before managed pricing.
    'draft', 'submitted', 'rejected', 'withdrawn'
  )),
  ADD CONSTRAINT marketplace_quotes_managed_price_check CHECK (
    customer_price_cents IS NULL
    OR (
      customer_price_cents > 0
      AND binder_payout_cents IS NOT NULL
      AND binder_payout_cents > 0
      AND binder_payout_cents <= customer_price_cents
    )
  ),
  ADD CONSTRAINT marketplace_quotes_decline_code_check CHECK (
    decline_reason_code IS NULL OR decline_reason_code IN (
      'payout_insufficient', 'deadline_impossible', 'outside_specialty',
      'no_capacity', 'other'
    )
  );

CREATE INDEX marketplace_quotes_offer_state_idx
  ON public.marketplace_quotes(case_id, state);

CREATE TABLE public.marketplace_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.marketplace_cases(id) ON DELETE CASCADE,
  binder_id UUID REFERENCES public.marketplace_binders(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_events_metadata_object_check
    CHECK (jsonb_typeof(metadata) = 'object')
);
GRANT ALL ON public.marketplace_events TO service_role;
ALTER TABLE public.marketplace_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access to marketplace_events"
  ON public.marketplace_events FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
CREATE INDEX marketplace_events_case_idx
  ON public.marketplace_events(case_id, created_at);
CREATE INDEX marketplace_events_type_idx
  ON public.marketplace_events(event_type, created_at);

CREATE OR REPLACE FUNCTION public.marketplace_validate_pricing(
  p_case_id UUID,
  p_customer_price_cents INTEGER,
  p_binder_payout_cents INTEGER,
  p_price_includes TEXT[],
  p_minimum_margin_bps INTEGER,
  p_minimum_margin_cents INTEGER,
  p_actor_user_id UUID
) RETURNS public.marketplace_cases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_case public.marketplace_cases;
  actual_margin INTEGER;
  required_margin INTEGER;
BEGIN
  IF p_customer_price_cents <= 0 OR p_binder_payout_cents <= 0
     OR p_binder_payout_cents > p_customer_price_cents THEN
    RAISE EXCEPTION 'Invalid managed price.' USING ERRCODE = 'check_violation';
  END IF;
  actual_margin := p_customer_price_cents - p_binder_payout_cents;
  required_margin := greatest(
    p_minimum_margin_cents,
    ceil(p_customer_price_cents * p_minimum_margin_bps / 10000.0)::integer
  );
  IF actual_margin < required_margin THEN
    RAISE EXCEPTION 'Managed price is below the configured minimum margin.'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.marketplace_cases
  SET customer_price_cents = p_customer_price_cents,
      binder_payout_cents = p_binder_payout_cents,
      price_includes = coalesce(p_price_includes, '{}'),
      pricing_status = 'validated',
      pricing_validated_at = now(),
      pricing_validated_by = p_actor_user_id,
      status = 'matching'
  WHERE id = p_case_id
    AND manual_review_required = false
    AND status <> 'cancelled'
  RETURNING * INTO updated_case;

  IF updated_case.id IS NULL THEN
    RAISE EXCEPTION 'Case is unavailable or still requires manual review.'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.marketplace_events(case_id, actor_user_id, event_type, metadata)
  VALUES (
    p_case_id,
    p_actor_user_id,
    'pricing_validated',
    jsonb_build_object(
      'customer_price_cents', p_customer_price_cents,
      'binder_payout_cents', p_binder_payout_cents
    )
  );
  RETURN updated_case;
END;
$$;

CREATE OR REPLACE FUNCTION public.marketplace_respond_to_offer(
  p_case_id UUID,
  p_binder_id UUID,
  p_accept BOOLEAN,
  p_reason_code TEXT,
  p_reason_detail TEXT,
  p_actor_user_id UUID
) RETURNS public.marketplace_quotes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_offer public.marketplace_quotes;
BEGIN
  IF NOT p_accept AND (p_reason_code IS NULL OR p_reason_code NOT IN (
    'payout_insufficient', 'deadline_impossible', 'outside_specialty',
    'no_capacity', 'other'
  )) THEN
    RAISE EXCEPTION 'A decline reason is required.' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT p_accept AND p_reason_code = 'other' AND nullif(trim(p_reason_detail), '') IS NULL THEN
    RAISE EXCEPTION 'A decline detail is required for other.' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.marketplace_quotes
  SET state = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
      accepted_at = CASE WHEN p_accept THEN now() ELSE NULL END,
      declined_at = CASE WHEN p_accept THEN NULL ELSE now() END,
      decline_reason_code = CASE WHEN p_accept THEN NULL ELSE p_reason_code END,
      decline_reason_detail = CASE WHEN p_accept THEN NULL ELSE nullif(trim(p_reason_detail), '') END,
      updated_at = now()
  WHERE case_id = p_case_id AND binder_id = p_binder_id AND state = 'offered'
  RETURNING * INTO updated_offer;

  IF updated_offer.id IS NULL THEN
    RAISE EXCEPTION 'This offer is no longer available.' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.marketplace_case_matches
  SET state = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
      responded_at = now(),
      accepted_at = CASE WHEN p_accept THEN now() ELSE NULL END,
      declined_at = CASE WHEN p_accept THEN NULL ELSE now() END,
      decline_reason_code = CASE WHEN p_accept THEN NULL ELSE p_reason_code END,
      decline_reason_detail = CASE WHEN p_accept THEN NULL ELSE nullif(trim(p_reason_detail), '') END,
      decline_reason = CASE WHEN p_accept THEN NULL ELSE p_reason_code END
  WHERE case_id = p_case_id AND binder_id = p_binder_id AND state = 'offered';

  IF p_accept THEN
    UPDATE public.marketplace_cases
    SET status = 'binder_accepted'
    WHERE id = p_case_id AND status = 'awaiting_binder_response';
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.marketplace_quotes
    WHERE case_id = p_case_id AND state IN ('offered', 'accepted')
  ) THEN
    UPDATE public.marketplace_cases SET status = 'matching' WHERE id = p_case_id;
  END IF;

  INSERT INTO public.marketplace_events(case_id, binder_id, actor_user_id, event_type, metadata)
  VALUES (
    p_case_id,
    p_binder_id,
    p_actor_user_id,
    CASE WHEN p_accept THEN 'offer_accepted' ELSE 'offer_declined' END,
    CASE WHEN p_accept THEN '{}'::jsonb ELSE jsonb_build_object('reason_code', p_reason_code) END
  );
  RETURN updated_offer;
END;
$$;

CREATE OR REPLACE FUNCTION public.marketplace_select_binder_offer(
  p_case_id UUID,
  p_binder_id UUID,
  p_actor_user_id UUID
) RETURNS public.marketplace_quotes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected_offer public.marketplace_quotes;
BEGIN
  PERFORM id FROM public.marketplace_cases WHERE id = p_case_id FOR UPDATE;

  UPDATE public.marketplace_quotes
  SET state = 'selected', selected_at = now()
  WHERE case_id = p_case_id AND binder_id = p_binder_id AND state = 'accepted'
  RETURNING * INTO selected_offer;

  IF selected_offer.id IS NULL THEN
    RAISE EXCEPTION 'Only an accepted offer can be selected.' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.marketplace_case_matches
  SET state = 'selected', selected_at = now()
  WHERE case_id = p_case_id AND binder_id = p_binder_id;
  UPDATE public.marketplace_case_matches
  SET state = 'cancelled'
  WHERE case_id = p_case_id
    AND binder_id <> p_binder_id
    AND state IN ('offered', 'accepted');
  UPDATE public.marketplace_quotes
  SET state = 'cancelled', updated_at = now()
  WHERE case_id = p_case_id
    AND binder_id <> p_binder_id
    AND state IN ('offered', 'accepted');
  UPDATE public.marketplace_cases SET status = 'binder_selected' WHERE id = p_case_id;
  INSERT INTO public.marketplace_events(case_id, binder_id, actor_user_id, event_type)
  VALUES (p_case_id, p_binder_id, p_actor_user_id, 'binder_selected');
  RETURN selected_offer;
END;
$$;

CREATE OR REPLACE FUNCTION public.marketplace_record_case_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    INSERT INTO public.marketplace_events(case_id, event_type)
    VALUES (NEW.id, 'case_completed');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER marketplace_cases_record_completion
  AFTER UPDATE OF status ON public.marketplace_cases
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_record_case_completion();

REVOKE ALL ON FUNCTION public.marketplace_validate_pricing(UUID, INTEGER, INTEGER, TEXT[], INTEGER, INTEGER, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marketplace_respond_to_offer(UUID, UUID, BOOLEAN, TEXT, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marketplace_select_binder_offer(UUID, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marketplace_record_case_completion()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_validate_pricing(UUID, INTEGER, INTEGER, TEXT[], INTEGER, INTEGER, UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.marketplace_respond_to_offer(UUID, UUID, BOOLEAN, TEXT, TEXT, UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.marketplace_select_binder_offer(UUID, UUID, UUID)
  TO service_role;
