-- Preserve existing historical exemptions. Closed-offer access is temporary, not a new exemption.
CREATE OR REPLACE FUNCTION public.marketplace_init_workshop_subscription() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
  INSERT INTO public.marketplace_binder_subscriptions(binder_id,legacy_free) VALUES(NEW.id,false);
  RETURN NEW;
END $$;
-- No existing subscription row is rewritten; no automatic subscription or charge is created.
ALTER TABLE public.marketplace_workshop_online_payments ADD COLUMN receipt_url text;
ALTER TABLE public.marketplace_workshop_online_refunds ADD COLUMN generation integer NOT NULL DEFAULT 0 CHECK(generation>=0);
ALTER TABLE public.marketplace_workshop_online_refunds ADD COLUMN status text NOT NULL DEFAULT 'reserved'
  CHECK(status IN ('reserved','pending','requires_action','succeeded','failed','canceled'));
CREATE TABLE public.marketplace_workshop_online_refund_attempts (
  stripe_refund_id text PRIMARY KEY, credit_note_id uuid NOT NULL REFERENCES public.marketplace_binder_credit_notes(id),
  status text NOT NULL CHECK(status IN ('failed','canceled')), archived_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marketplace_workshop_online_refund_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_workshop_online_refund_attempts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.marketplace_workshop_online_refund_attempts TO service_role;
CREATE FUNCTION public.marketplace_retry_workshop_refund(p_binder_id uuid,p_credit_note_id uuid,p_refund_id text,p_status text)
RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE p marketplace_workshop_online_payments%ROWTYPE; r marketplace_workshop_online_refunds%ROWTYPE; pid uuid;
BEGIN
  SELECT payment_id INTO STRICT pid FROM marketplace_workshop_online_refunds WHERE credit_note_id=p_credit_note_id;
  SELECT * INTO STRICT p FROM marketplace_workshop_online_payments WHERE id=pid AND binder_id=p_binder_id FOR UPDATE;
  SELECT * INTO STRICT r FROM marketplace_workshop_online_refunds WHERE credit_note_id=p_credit_note_id FOR UPDATE;
  IF r.stripe_refund_id IS DISTINCT FROM p_refund_id THEN RETURN; END IF;
  IF p_status NOT IN ('failed','canceled') OR p.disputed OR p.reconciliation_required THEN RAISE EXCEPTION 'refund_retry_refused'; END IF;
  INSERT INTO marketplace_workshop_online_refund_attempts(stripe_refund_id,credit_note_id,status)
    VALUES(p_refund_id,p_credit_note_id,p_status) ON CONFLICT DO NOTHING;
  UPDATE marketplace_workshop_online_refunds SET stripe_refund_id=NULL,status='reserved',generation=generation+1 WHERE credit_note_id=p_credit_note_id;
END $$;
REVOKE ALL ON FUNCTION marketplace_retry_workshop_refund(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_retry_workshop_refund(uuid,uuid,text,text) TO service_role;
