-- Les frais et le reçu sont propres à une tentative Stripe, jamais reportés sur la suivante.
-- Aucun paiement déjà reçu ni document historique n'est modifié.
CREATE OR REPLACE FUNCTION public.marketplace_release_workshop_payment_checkout(
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
    checkout_expires_at=NULL, status='ready', stripe_fee_cents=NULL, fee_refunded_cents=NULL,
    receipt_url=NULL, updated_at=now() WHERE id=p.id;
END $$;
REVOKE ALL ON FUNCTION marketplace_release_workshop_payment_checkout(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_release_workshop_payment_checkout(uuid,text,text,text) TO service_role;
-- Retour arrière : fermer C ; conserver la réception des webhooks et la comptabilité existante.
