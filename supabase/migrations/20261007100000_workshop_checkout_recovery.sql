-- No clock-only release of an identified Checkout. Stripe must prove expiry or cancellation.
-- Additive: preserves invoices, refunds, historical session and subscription identifiers.
CREATE TABLE public.marketplace_workshop_checkout_attempts (
  checkout_session_id text PRIMARY KEY,
  payment_id uuid REFERENCES public.marketplace_workshop_online_payments(id),
  binder_id uuid NOT NULL REFERENCES public.marketplace_binders(id),
  payment_intent_id text,
  terminal_reason text NOT NULL CHECK (terminal_reason IN ('expired','canceled','subscription_ended')),
  archived_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marketplace_workshop_checkout_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_workshop_checkout_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.marketplace_workshop_checkout_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.marketplace_reserve_workshop_payment_checkout(p_payment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE p marketplace_workshop_online_payments%ROWTYPE;
BEGIN
  SELECT * INTO STRICT p FROM marketplace_workshop_online_payments WHERE id=p_payment_id FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM marketplace_workshop_offer_settings WHERE online_payment_open)
    OR p.token_expires_at<=now() OR p.status NOT IN ('ready','failed') OR p.paid_at IS NOT NULL
    OR p.disputed OR p.reconciliation_required THEN RAISE EXCEPTION 'checkout_unavailable'; END IF;
  IF p.checkout_session_id IS NULL AND (p.checkout_expires_at IS NULL OR p.checkout_expires_at<=now()) THEN
    UPDATE marketplace_workshop_online_payments SET checkout_expires_at=now()+interval '1 hour',
      status='ready' WHERE id=p.id RETURNING * INTO p;
  END IF;
  RETURN to_jsonb(p);
END $$;

-- Callable only by the server, after re-reading/terminating the same Stripe attempt.
CREATE FUNCTION public.marketplace_release_workshop_payment_checkout(
  p_payment_id uuid, p_session_id text, p_intent_id text, p_reason text
) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE p marketplace_workshop_online_payments%ROWTYPE;
BEGIN
  SELECT * INTO STRICT p FROM marketplace_workshop_online_payments WHERE id=p_payment_id FOR UPDATE;
  IF p.checkout_session_id IS DISTINCT FROM p_session_id THEN RETURN; END IF;
  IF p.paid_at IS NOT NULL OR p.refunded_cents<>0 OR p.disputed OR p.reconciliation_required
    OR p_reason NOT IN ('expired','canceled') THEN RAISE EXCEPTION 'checkout_release_refused'; END IF;
  INSERT INTO marketplace_workshop_checkout_attempts(checkout_session_id,payment_id,binder_id,payment_intent_id,terminal_reason)
    VALUES(p_session_id,p.id,p.binder_id,p_intent_id,p_reason) ON CONFLICT DO NOTHING;
  UPDATE marketplace_workshop_online_payments SET checkout_session_id=NULL, payment_intent_id=NULL,
    checkout_expires_at=NULL, status='ready', updated_at=now() WHERE id=p.id;
END $$;

CREATE OR REPLACE FUNCTION public.marketplace_reserve_workshop_checkout(p_binder_id uuid,p_user_id uuid,p_terms_version text)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE s marketplace_binder_subscriptions%ROWTYPE;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM marketplace_workshop_offer_settings WHERE subscription_open) THEN RAISE EXCEPTION 'workshop_subscription_closed'; END IF;
  IF NOT EXISTS(SELECT 1 FROM marketplace_binder_members WHERE binder_id=p_binder_id AND user_id=p_user_id AND role='OWNER' AND account_status='active') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO STRICT s FROM marketplace_binder_subscriptions WHERE binder_id=p_binder_id FOR UPDATE;
  IF s.stripe_subscription_id IS NOT NULL AND s.status NOT IN ('canceled','incomplete_expired') THEN RAISE EXCEPTION 'workshop_subscription_exists'; END IF;
  IF s.checkout_session_id IS NULL AND (s.checkout_expires_at IS NULL OR s.checkout_expires_at<=now()) THEN
    UPDATE marketplace_binder_subscriptions SET checkout_expires_at=now()+interval '1 hour',
      transition_accepted_at=now(), transition_accepted_by=p_user_id, terms_version=p_terms_version,
      updated_at=now() WHERE binder_id=p_binder_id RETURNING * INTO s;
  END IF;
  RETURN to_jsonb(s);
END $$;
CREATE FUNCTION public.marketplace_release_workshop_subscription_checkout(p_binder_id uuid,p_session_id text,p_reason text)
RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE s marketplace_binder_subscriptions%ROWTYPE;
BEGIN
  SELECT * INTO STRICT s FROM marketplace_binder_subscriptions WHERE binder_id=p_binder_id FOR UPDATE;
  IF s.checkout_session_id IS DISTINCT FROM p_session_id THEN RETURN; END IF;
  IF s.stripe_subscription_id IS NOT NULL AND s.status NOT IN ('canceled','incomplete_expired') THEN RAISE EXCEPTION 'workshop_subscription_exists'; END IF;
  IF p_reason NOT IN ('expired','subscription_ended') THEN RAISE EXCEPTION 'checkout_release_refused'; END IF;
  INSERT INTO marketplace_workshop_checkout_attempts(checkout_session_id,binder_id,terminal_reason)
    VALUES(p_session_id,p_binder_id,p_reason) ON CONFLICT DO NOTHING;
  UPDATE marketplace_binder_subscriptions SET checkout_session_id=NULL,checkout_expires_at=NULL,
    updated_at=now() WHERE binder_id=p_binder_id;
END $$;
REVOKE ALL ON FUNCTION marketplace_release_workshop_payment_checkout(uuid,text,text,text),
  marketplace_release_workshop_subscription_checkout(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_release_workshop_payment_checkout(uuid,text,text,text),
  marketplace_release_workshop_subscription_checkout(uuid,text,text) TO service_role;
-- Rollback: close both offers, keep the schema and compatible webhook processing.

-- Invoice balances project evidence from exactly one circuit, never a declared Stripe receipt.
CREATE OR REPLACE FUNCTION public.marketplace_external_balance_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE net bigint; p marketplace_workshop_online_payments%ROWTYPE;
BEGIN
  IF NEW.payment_snapshot->>'agreement_version'='own-external-v1' THEN
    IF NEW.status='issued' AND (SELECT terms->'seller'->>'siret' FROM marketplace_own_client_agreements WHERE quote_id=NEW.quote_id)
      IS DISTINCT FROM NEW.issuer->>'siret' THEN RAISE EXCEPTION 'invoice_seller_changed_new_agreement_required'; END IF;
    SELECT * INTO p FROM marketplace_workshop_online_payments WHERE invoice_id=NEW.id;
    IF FOUND THEN
      IF EXISTS(SELECT 1 FROM marketplace_external_settlements WHERE invoice_id=NEW.id) THEN RAISE EXCEPTION 'mixed_payment_evidence'; END IF;
      net := CASE WHEN p.paid_at IS NULL THEN 0 ELSE p.amount_cents-p.refunded_cents END;
    ELSE
      SELECT coalesce(sum(CASE WHEN kind='receipt' THEN amount_cents WHEN kind='refund' THEN -amount_cents ELSE 0 END),0)
        INTO net FROM marketplace_external_settlements WHERE invoice_id=NEW.id;
    END IF;
    IF NEW.amount_paid_cents IS DISTINCT FROM net OR NEW.deposit_paid_cents<>0
      OR NEW.payment_status IS DISTINCT FROM (CASE WHEN net=0 THEN 'unpaid' WHEN net=NEW.total_ttc_cents THEN 'paid' ELSE 'partial' END)
      OR (NEW.paid_at IS NOT NULL) IS DISTINCT FROM (net>0 AND net=NEW.total_ttc_cents) THEN
      RAISE EXCEPTION 'payment_evidence_required';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE FUNCTION public.marketplace_project_online_invoice_balance() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE net integer;
BEGIN
  net := CASE WHEN NEW.paid_at IS NULL THEN 0 ELSE NEW.amount_cents-NEW.refunded_cents END;
  UPDATE marketplace_binder_invoices SET amount_paid_cents=net, deposit_paid_cents=0,
    payment_status=CASE WHEN net=0 THEN 'unpaid' WHEN net=total_ttc_cents THEN 'paid' ELSE 'partial' END,
    paid_at=CASE WHEN net>0 AND net=total_ttc_cents THEN NEW.paid_at ELSE NULL END
    WHERE id=NEW.invoice_id AND binder_id=NEW.binder_id;
  RETURN NEW;
END $$;
CREATE TRIGGER project_workshop_online_balance AFTER INSERT OR UPDATE OF paid_at,refunded_cents
  ON public.marketplace_workshop_online_payments FOR EACH ROW EXECUTE FUNCTION marketplace_project_online_invoice_balance();

CREATE TABLE public.marketplace_workshop_billing_documents (
  stripe_invoice_id text PRIMARY KEY, binder_id uuid NOT NULL REFERENCES public.marketplace_binders(id),
  stripe_subscription_id text NOT NULL, number text, status text NOT NULL, currency text NOT NULL,
  total_cents integer NOT NULL, paid_cents integer NOT NULL, invoice_url text, pdf_url text,
  issued_at timestamptz NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.marketplace_workshop_notices (
  id text PRIMARY KEY, binder_id uuid NOT NULL REFERENCES public.marketplace_binders(id),
  heading text NOT NULL, intro text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz, processing_until timestamptz, claim_token uuid
);
ALTER TABLE public.marketplace_workshop_billing_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_workshop_notices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_workshop_billing_documents,public.marketplace_workshop_notices FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.marketplace_workshop_billing_documents,public.marketplace_workshop_notices TO service_role;
CREATE FUNCTION public.marketplace_claim_workshop_notice(p_id text) RETURNS uuid LANGUAGE plpgsql SET search_path=public AS $$
DECLARE token uuid := gen_random_uuid(); result uuid;
BEGIN
  UPDATE marketplace_workshop_notices SET processing_until=now()+interval '5 minutes',claim_token=token
    WHERE id=p_id AND sent_at IS NULL AND (processing_until IS NULL OR processing_until<now()) RETURNING claim_token INTO result;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION marketplace_claim_workshop_notice(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_claim_workshop_notice(text) TO service_role;
