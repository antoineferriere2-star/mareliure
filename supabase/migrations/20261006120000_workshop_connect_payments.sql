-- C : atelier vendeur, encaissement traité distinct des règlements déclarés.
CREATE TABLE public.marketplace_workshop_connect_consents (
  binder_id uuid PRIMARY KEY REFERENCES marketplace_binders(id),
  accepted_by uuid NOT NULL REFERENCES auth.users(id), accepted_at timestamptz NOT NULL DEFAULT now(),
  terms_version text NOT NULL, fee_bps integer NOT NULL DEFAULT 300 CHECK(fee_bps=300)
);
CREATE TABLE public.marketplace_workshop_online_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), binder_id uuid NOT NULL REFERENCES marketplace_binders(id),
  invoice_id uuid NOT NULL UNIQUE REFERENCES marketplace_binder_invoices(id),
  stripe_account_id text NOT NULL, token_hash text NOT NULL UNIQUE, token_expires_at timestamptz NOT NULL,
  amount_cents integer NOT NULL CHECK(amount_cents>0), fee_cents integer NOT NULL CHECK(fee_cents>=0),
  currency text NOT NULL CHECK(currency='eur'), status text NOT NULL DEFAULT 'ready'
    CHECK(status IN ('ready','processing','paid','failed','refunded')),
  checkout_session_id text UNIQUE, checkout_expires_at timestamptz, payment_intent_id text UNIQUE,
  paid_at timestamptz, refunded_cents integer NOT NULL DEFAULT 0, disputed boolean NOT NULL DEFAULT false,
  stripe_fee_cents integer, reconciliation_required boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(), CHECK(refunded_cents BETWEEN 0 AND amount_cents)
);
CREATE TABLE public.marketplace_workshop_online_refunds (
  credit_note_id uuid PRIMARY KEY REFERENCES marketplace_binder_credit_notes(id),
  payment_id uuid NOT NULL REFERENCES marketplace_workshop_online_payments(id),
  amount_cents integer NOT NULL CHECK(amount_cents>0), stripe_refund_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION public.marketplace_reserve_workshop_online_payment(
  p_binder_id uuid,p_invoice_id uuid,p_token_hash text,p_expires_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE i marketplace_binder_invoices%ROWTYPE; w marketplace_binder_works%ROWTYPE;
  b marketplace_binders%ROWTYPE; p marketplace_workshop_online_payments%ROWTYPE;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM marketplace_workshop_offer_settings WHERE online_payment_open) THEN RAISE EXCEPTION 'online_payment_closed'; END IF;
  SELECT * INTO STRICT i FROM marketplace_binder_invoices WHERE id=p_invoice_id AND binder_id=p_binder_id FOR UPDATE;
  SELECT * INTO STRICT w FROM marketplace_binder_works WHERE id=(SELECT work_id FROM marketplace_binder_quotes WHERE id=i.quote_id) AND binder_id=p_binder_id;
  IF w.source NOT IN ('mon_client','workshop_platform') OR i.status<>'issued' OR i.currency<>'EUR' OR i.deposit_cents<>0 OR i.total_ttc_cents<=0 THEN RAISE EXCEPTION 'online_invoice_ineligible'; END IF;
  IF EXISTS(SELECT 1 FROM marketplace_external_settlements WHERE invoice_id=i.id)
    OR EXISTS(SELECT 1 FROM marketplace_binder_credit_notes WHERE invoice_id=i.id) THEN RAISE EXCEPTION 'online_invoice_already_settled'; END IF;
  IF NOT EXISTS(SELECT 1 FROM marketplace_workshop_connect_consents WHERE binder_id=p_binder_id) THEN RAISE EXCEPTION 'connect_consent_required'; END IF;
  SELECT * INTO STRICT b FROM marketplace_binders WHERE id=p_binder_id;
  IF b.stripe_account_id IS NULL OR NOT b.stripe_connect_charges_enabled OR NOT b.stripe_connect_payouts_enabled THEN RAISE EXCEPTION 'connect_not_ready'; END IF;
  SELECT * INTO p FROM marketplace_workshop_online_payments WHERE invoice_id=i.id;
  IF FOUND THEN RETURN to_jsonb(p); END IF;
  INSERT INTO marketplace_workshop_online_payments(binder_id,invoice_id,stripe_account_id,token_hash,token_expires_at,amount_cents,fee_cents,currency)
    VALUES(p_binder_id,p_invoice_id,b.stripe_account_id,p_token_hash,p_expires_at,i.total_ttc_cents,round(i.total_ttc_cents::numeric*300/10000),'eur') RETURNING * INTO p;
  RETURN to_jsonb(p);
END $$;
CREATE FUNCTION public.marketplace_reserve_workshop_payment_checkout(p_payment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE p marketplace_workshop_online_payments%ROWTYPE;
BEGIN
  SELECT * INTO STRICT p FROM marketplace_workshop_online_payments WHERE id=p_payment_id FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM marketplace_workshop_offer_settings WHERE online_payment_open)
    OR p.token_expires_at<=now() OR p.status NOT IN ('ready','failed') THEN RAISE EXCEPTION 'checkout_unavailable'; END IF;
  IF p.checkout_expires_at IS NULL OR p.checkout_expires_at<=now() THEN
    UPDATE marketplace_workshop_online_payments SET checkout_session_id=NULL, checkout_expires_at=now()+interval '1 hour', status='ready' WHERE id=p.id RETURNING * INTO p;
  END IF;
  RETURN to_jsonb(p);
END $$;
-- L'écriture externe utilise déjà le verrou facture ; celui-ci protège aussi la réservation Connect.
CREATE FUNCTION public.marketplace_prevent_mixed_settlement() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
  PERFORM 1 FROM marketplace_binder_invoices WHERE id=NEW.invoice_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM marketplace_workshop_online_payments WHERE invoice_id=NEW.invoice_id) THEN RAISE EXCEPTION 'online_payment_circuit_reserved'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER marketplace_prevent_mixed_settlement BEFORE INSERT ON marketplace_external_settlements
FOR EACH ROW EXECUTE FUNCTION marketplace_prevent_mixed_settlement();
CREATE FUNCTION public.marketplace_reserve_workshop_refund(p_binder_id uuid,p_payment_id uuid,p_credit_note_id uuid)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE p marketplace_workshop_online_payments%ROWTYPE; c marketplace_binder_credit_notes%ROWTYPE;
  r marketplace_workshop_online_refunds%ROWTYPE;
BEGIN
  SELECT * INTO STRICT p FROM marketplace_workshop_online_payments WHERE id=p_payment_id AND binder_id=p_binder_id FOR UPDATE;
  SELECT * INTO STRICT c FROM marketplace_binder_credit_notes WHERE id=p_credit_note_id AND invoice_id=p.invoice_id AND binder_id=p_binder_id;
  SELECT * INTO r FROM marketplace_workshop_online_refunds WHERE credit_note_id=c.id;
  IF FOUND THEN RETURN to_jsonb(r); END IF;
  IF p.paid_at IS NULL OR p.disputed OR p.reconciliation_required OR c.total_ttc_cents<=0 OR
     c.total_ttc_cents+greatest(p.refunded_cents,coalesce((SELECT sum(amount_cents) FROM marketplace_workshop_online_refunds WHERE payment_id=p.id),0))>p.amount_cents
    THEN RAISE EXCEPTION 'refund_unavailable'; END IF;
  INSERT INTO marketplace_workshop_online_refunds(credit_note_id,payment_id,amount_cents)
    VALUES(c.id,p.id,c.total_ttc_cents) RETURNING * INTO r;
  RETURN to_jsonb(r);
END $$;
ALTER TABLE marketplace_workshop_connect_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_workshop_online_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_workshop_online_refunds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON marketplace_workshop_connect_consents,marketplace_workshop_online_payments,marketplace_workshop_online_refunds FROM anon,authenticated;
GRANT ALL ON marketplace_workshop_connect_consents,marketplace_workshop_online_payments,marketplace_workshop_online_refunds TO service_role;
REVOKE ALL ON FUNCTION marketplace_reserve_workshop_online_payment(uuid,uuid,text,timestamptz),marketplace_reserve_workshop_payment_checkout(uuid),marketplace_reserve_workshop_refund(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_reserve_workshop_online_payment(uuid,uuid,text,timestamptz),marketplace_reserve_workshop_payment_checkout(uuid),marketplace_reserve_workshop_refund(uuid,uuid,uuid) TO service_role;
-- Retour arrière : fermer online_payment_open, continuer à recevoir les webhooks et remboursements.
