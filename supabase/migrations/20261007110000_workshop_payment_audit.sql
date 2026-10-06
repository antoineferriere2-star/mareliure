ALTER TABLE public.marketplace_workshop_online_payments ADD COLUMN fee_refunded_cents integer
  CHECK(fee_refunded_cents BETWEEN 0 AND fee_cents);
CREATE TABLE public.marketplace_workshop_online_disputes (
  stripe_dispute_id text PRIMARY KEY, payment_id uuid NOT NULL REFERENCES public.marketplace_workshop_online_payments(id),
  status text NOT NULL, amount_cents integer NOT NULL CHECK(amount_cents>0), currency text NOT NULL,
  reason text NOT NULL, evidence_due_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marketplace_workshop_online_disputes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_workshop_online_disputes FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.marketplace_workshop_online_disputes TO service_role;
-- A delayed processing snapshot cannot undo a confirmed payment.
CREATE FUNCTION public.marketplace_preserve_confirmed_online_payment() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF OLD.paid_at IS NOT NULL THEN
    IF NEW.payment_intent_id IS DISTINCT FROM OLD.payment_intent_id
      OR NEW.checkout_session_id IS DISTINCT FROM OLD.checkout_session_id THEN RAISE EXCEPTION 'confirmed_payment_immutable'; END IF;
    NEW.paid_at := OLD.paid_at;
    IF NEW.status IN ('ready','failed','processing') THEN NEW.status:=OLD.status; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER preserve_confirmed_workshop_payment BEFORE UPDATE ON public.marketplace_workshop_online_payments
  FOR EACH ROW EXECUTE FUNCTION marketplace_preserve_confirmed_online_payment();
-- Rollback: keep both offers closed and retain all financial evidence.

-- Captures are a separate channel, available only in the isolated Stripe-test recipe.
ALTER TABLE public.marketplace_workshop_notices ADD COLUMN captured_at timestamptz,
  ADD COLUMN captured_text text;
CREATE OR REPLACE FUNCTION public.marketplace_claim_workshop_notice(p_id text) RETURNS uuid LANGUAGE plpgsql SET search_path=public AS $$
DECLARE token uuid := gen_random_uuid(); result uuid;
BEGIN
  UPDATE marketplace_workshop_notices SET processing_until=now()+interval '5 minutes',claim_token=token
    WHERE id=p_id AND sent_at IS NULL AND captured_at IS NULL
      AND (processing_until IS NULL OR processing_until<now()) RETURNING claim_token INTO result;
  RETURN result;
END $$;
