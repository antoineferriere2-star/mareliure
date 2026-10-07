-- C accepte aussi les factures de clients propres sans livre rattaché.
-- Chaque référence présente doit appartenir à l'atelier et au circuit client propre.
-- Aucun document historique ni paramètre d'ouverture n'est modifié.
CREATE OR REPLACE FUNCTION public.marketplace_reserve_workshop_online_payment(
  p_binder_id uuid,p_invoice_id uuid,p_token_hash text,p_expires_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE i marketplace_binder_invoices%ROWTYPE; q marketplace_binder_quotes%ROWTYPE;
  b marketplace_binders%ROWTYPE; p marketplace_workshop_online_payments%ROWTYPE;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM marketplace_workshop_offer_settings WHERE online_payment_open) THEN RAISE EXCEPTION 'online_payment_closed'; END IF;
  SELECT * INTO STRICT i FROM marketplace_binder_invoices WHERE id=p_invoice_id AND binder_id=p_binder_id FOR UPDATE;
  SELECT * INTO STRICT q FROM marketplace_binder_quotes WHERE id=i.quote_id AND binder_id=p_binder_id;
  IF (q.work_id IS NULL AND q.client_id IS NULL)
    OR (q.work_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM marketplace_binder_works WHERE id=q.work_id AND binder_id=p_binder_id AND source IN ('mon_client','workshop_platform')))
    OR (q.client_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM marketplace_binder_clients WHERE id=q.client_id AND binder_id=p_binder_id AND origin IN ('mon_client','workshop_platform')))
    OR i.status<>'issued' OR i.currency<>'EUR' OR i.deposit_cents<>0 OR i.total_ttc_cents<=0
    THEN RAISE EXCEPTION 'online_invoice_ineligible'; END IF;
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
REVOKE ALL ON FUNCTION marketplace_reserve_workshop_online_payment(uuid,uuid,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_reserve_workshop_online_payment(uuid,uuid,text,timestamptz) TO service_role;
-- Retour arrière : fermer C ; conserver les webhooks et remboursements existants.
