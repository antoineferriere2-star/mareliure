-- Retour arrière de la phase 1 de la facturation électronique (migration 20261023100000).
--
-- À n'appliquer qu'avec le retour du Worker à la version précédente : l'application de la phase 1
-- appelle des fonctions et des colonnes que ce script retire ou neutralise.
--
-- Aucune donnée n'est supprimée. Restent en place, ignorés par l'ancienne application :
--   colonnes (régime d'imposition, préfixes en attente, pdf_path / pdf_sha256, payment_method /
--   payment_reference, operation_nature des prestations et des lignes), bucket et PDF rangés,
--   fonctions de contrôle (SIREN, date de Paris), déclencheurs « nature par défaut » (sans effet sur
--   l'ancienne application, qui n'envoie pas la nature).
-- Rétablis dans leur version antérieure (copiée des migrations 20260923120000 et 20260928110000) :
--   déclencheurs, contraintes et fonctions d'émission, de brouillon, d'avoir et d'encaissement.
-- Les pays déjà convertis en codes ISO le restent (l'ancienne application les accepte).
--
-- Testé sur une copie PGlite (src/marketplace/invoices/einvoicingPhase1.migration.test.ts, « retour arrière »).

BEGIN;

-- 1. Préfixes : plus de report au 1er janvier.
DROP TRIGGER IF EXISTS marketplace_binder_prefix_change_guard ON public.marketplace_binder_billing_profiles;
DROP TRIGGER IF EXISTS marketplace_binder_promote_pending_prefix ON public.marketplace_binder_document_counters;

-- 2. Avoirs : déclencheur d'immuabilité d'origine, plus de contrôle « daté du jour ».
DROP TRIGGER IF EXISTS marketplace_binder_credit_note_issue_today ON public.marketplace_binder_credit_notes;
DROP TRIGGER IF EXISTS marketplace_binder_credit_notes_immutable ON public.marketplace_binder_credit_notes;
CREATE TRIGGER marketplace_binder_credit_notes_immutable
  BEFORE UPDATE OR DELETE ON public.marketplace_binder_credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_binder_credit_notes_immutable();
REVOKE UPDATE (pdf_path, pdf_sha256) ON public.marketplace_binder_credit_notes FROM service_role;

-- 3. Factures : immuabilité, émission et brouillon d'origine ; l'horloge d'émission n'est plus utilisée et disparaît.
CREATE OR REPLACE FUNCTION public.marketplace_binder_invoices_forbid_content_change()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_mutable TEXT[] := ARRAY[
    'updated_at', 'deposit_paid_cents', 'amount_paid_cents', 'payment_status', 'paid_at',
    'external_provider', 'external_invoice_id', 'external_status', 'electronic_invoice_status',
    'electronic_invoice_sent_at', 'external_metadata', 'electronic_invoice_provider',
    'provider_invoice_id', 'provider_status', 'provider_sent_at', 'reporting_status'
  ];
BEGIN
  IF OLD.status IN ('issued', 'credited')
    AND (to_jsonb(NEW) - v_mutable) IS DISTINCT FROM (to_jsonb(OLD) - v_mutable) THEN
    RAISE EXCEPTION 'marketplace_binder_invoices content is immutable once issued (invoice %)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.marketplace_binder_issue_invoice(
  p_binder_id UUID, p_invoice_id UUID, p_legal_mentions JSONB
) RETURNS UUID LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_invoice public.marketplace_binder_invoices%ROWTYPE;
  v_number TEXT;
BEGIN
  SELECT * INTO v_invoice FROM public.marketplace_binder_invoices
  WHERE id = p_invoice_id AND binder_id = p_binder_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice_not_found'; END IF;
  IF v_invoice.status IN ('issued', 'credited') THEN RETURN v_invoice.id; END IF;
  IF v_invoice.service_date IS NULL OR v_invoice.due_date IS NULL OR v_invoice.due_date < v_invoice.issue_date
    OR v_invoice.operation_nature IS NULL OR v_invoice.client_type IS NULL
    OR v_invoice.client_billing_address_line1 IS NULL OR v_invoice.client_billing_postal_code IS NULL
    OR v_invoice.client_billing_city IS NULL THEN RAISE EXCEPTION 'invoice_incomplete'; END IF;
  IF NULLIF(btrim(v_invoice.issuer->>'legalForm'), '') IS NULL
    OR NULLIF(btrim(v_invoice.issuer->>'siren'), '') IS NULL
    OR NULLIF(btrim(v_invoice.issuer->>'siret'), '') IS NULL
    OR NULLIF(btrim(v_invoice.issuer->>'addressLine1'), '') IS NULL
    OR NULLIF(btrim(v_invoice.issuer->>'postalCode'), '') IS NULL
    OR NULLIF(btrim(v_invoice.issuer->>'city'), '') IS NULL THEN RAISE EXCEPTION 'invoice_incomplete'; END IF;
  IF v_invoice.vat_regime = 'VAT_LIABLE' AND NULLIF(btrim(v_invoice.issuer->>'vatNumber'), '') IS NULL
    THEN RAISE EXCEPTION 'invoice_incomplete'; END IF;
  IF v_invoice.vat_regime IN ('FRANCHISE', 'EXEMPT') AND NULLIF(btrim(v_invoice.vat_mention), '') IS NULL
    THEN RAISE EXCEPTION 'invoice_incomplete'; END IF;
  IF v_invoice.client_type IN ('business', 'public_entity') AND (
    NULLIF(btrim(v_invoice.client_legal_name), '') IS NULL OR NULLIF(btrim(v_invoice.payment_terms), '') IS NULL
    OR NULLIF(btrim(v_invoice.early_payment_discount_terms), '') IS NULL
    OR NULLIF(btrim(v_invoice.late_penalty_terms), '') IS NULL
  ) THEN RAISE EXCEPTION 'invoice_incomplete'; END IF;
  IF v_invoice.client_type = 'public_entity' AND NULLIF(btrim(v_invoice.client_siren), '') IS NULL
    THEN RAISE EXCEPTION 'invoice_incomplete'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.marketplace_binder_invoice_items WHERE invoice_id = p_invoice_id)
    THEN RAISE EXCEPTION 'invoice_incomplete'; END IF;

  v_number := public.marketplace_binder_next_document_number(
    p_binder_id, 'invoice', EXTRACT(YEAR FROM v_invoice.issue_date)::integer);
  UPDATE public.marketplace_binder_invoices SET
    invoice_number = v_number, status = 'issued', issued_at = now(),
    legal_mentions = COALESCE(p_legal_mentions, '[]'::jsonb),
    retained_until = (date_trunc('year', issue_date) + interval '11 years - 1 day')::date,
    updated_at = now()
  WHERE id = p_invoice_id;
  UPDATE public.marketplace_binder_quotes SET status = 'invoiced' WHERE id = v_invoice.quote_id;
  RETURN p_invoice_id;
END;
$$;

DROP FUNCTION IF EXISTS public.marketplace_issue_clock();

CREATE OR REPLACE FUNCTION public.marketplace_binder_create_invoice_draft(
  p_binder_id UUID, p_quote_id UUID, p_draft JSONB
) RETURNS UUID LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_quote public.marketplace_binder_quotes%ROWTYPE;
  v_existing UUID;
  v_id UUID := gen_random_uuid();
BEGIN
  SELECT id INTO v_existing FROM public.marketplace_binder_invoices
  WHERE quote_id = p_quote_id AND binder_id = p_binder_id;
  IF FOUND THEN RETURN v_existing; END IF;

  SELECT * INTO v_quote FROM public.marketplace_binder_quotes
  WHERE id = p_quote_id AND binder_id = p_binder_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'quote_not_found'; END IF;
  IF v_quote.status <> 'accepted' THEN RAISE EXCEPTION 'quote_not_accepted'; END IF;

  INSERT INTO public.marketplace_binder_invoices (
    id, binder_id, quote_id, client_id, invoice_number, status, issue_date,
    service_date, due_date, operation_nature,
    client_name, client_email, client_phone, client_address_line1, client_postal_code, client_city, client_country,
    client_type, client_legal_name, client_billing_address_line1, client_billing_postal_code,
    client_billing_city, client_billing_country, client_siren, client_vat_number,
    client_purchase_order_number, client_public_service_code, client_public_commitment_number,
    book_title, book_author, height_mm, width_mm, spine_mm, book_notes,
    currency, issuer, vat_regime, vat_mention, payment_terms, notes,
    early_payment_discount_terms, late_penalty_terms,
    subtotal_cents, discount_type, discount_value, discount_cents,
    total_ht_cents, total_vat_cents, total_ttc_cents, vat_breakdown,
    deposit_type, deposit_value, deposit_cents
  ) VALUES (
    v_id, p_binder_id, p_quote_id, v_quote.client_id, NULL, 'draft', (p_draft->>'issue_date')::date,
    (p_draft->>'service_date')::date, (p_draft->>'due_date')::date, p_draft->>'operation_nature',
    v_quote.client_name, v_quote.client_email, v_quote.client_phone, v_quote.client_address_line1,
    v_quote.client_postal_code, v_quote.client_city, v_quote.client_country,
    p_draft->>'client_type', p_draft->>'client_legal_name',
    COALESCE(p_draft->>'client_billing_address_line1', v_quote.client_address_line1),
    COALESCE(p_draft->>'client_billing_postal_code', v_quote.client_postal_code),
    COALESCE(p_draft->>'client_billing_city', v_quote.client_city),
    COALESCE(p_draft->>'client_billing_country', v_quote.client_country),
    p_draft->>'client_siren', p_draft->>'client_vat_number', p_draft->>'client_purchase_order_number',
    p_draft->>'client_public_service_code', p_draft->>'client_public_commitment_number',
    v_quote.book_title, v_quote.book_author, v_quote.height_mm, v_quote.width_mm, v_quote.spine_mm, v_quote.book_notes,
    v_quote.currency, p_draft->'issuer', v_quote.vat_regime, p_draft->>'vat_mention',
    p_draft->>'payment_terms', p_draft->>'notes', p_draft->>'early_payment_discount_terms',
    p_draft->>'late_penalty_terms', v_quote.subtotal_cents, v_quote.discount_type, v_quote.discount_value,
    v_quote.discount_cents, v_quote.total_ht_cents, v_quote.total_vat_cents, v_quote.total_ttc_cents,
    v_quote.vat_breakdown, v_quote.deposit_type, v_quote.deposit_value, v_quote.deposit_cents
  );

  INSERT INTO public.marketplace_binder_invoice_items (
    invoice_id, binder_id, position, line_key, block_key, block_label, block_book_count,
    block_height_mm, block_width_mm, block_spine_mm, service_id, label, description,
    unit, quantity, unit_price_cents, vat_rate_bps, total_ht_cents
  ) SELECT v_id, binder_id, position, line_key, block_key, block_label, block_book_count,
    block_height_mm, block_width_mm, block_spine_mm, service_id, label, description,
    unit, quantity, unit_price_cents, vat_rate_bps, total_ht_cents
  FROM public.marketplace_binder_quote_items
  WHERE quote_id = p_quote_id AND binder_id = p_binder_id ORDER BY position;
  RETURN v_id;
END;
$$;

-- Régime « exonéré » : l'ancienne application le propose encore.
ALTER TABLE public.marketplace_binder_billing_profiles DROP CONSTRAINT IF EXISTS marketplace_binder_billing_profiles_no_exempt;

-- 4. Encaissements : le justificatif libre redevient obligatoire (8 à 500 caractères).
--    Une écriture de la phase 1 sans note reçoit un texte tiré de son mode et de sa référence.
-- Reprise faite par le propriétaire, déclencheur d'immuabilité suspendu le temps de cette seule mise à jour.
ALTER TABLE public.marketplace_external_settlements DISABLE TRIGGER settlement_immutable;
UPDATE public.marketplace_external_settlements
SET evidence = left(
  concat_ws(' · ', NULLIF(btrim(evidence), ''), 'Mode : ' || payment_method, 'Réf. ' || payment_reference), 500)
WHERE evidence IS NULL OR length(btrim(evidence)) < 8;
ALTER TABLE public.marketplace_external_settlements ENABLE TRIGGER settlement_immutable;
DROP INDEX IF EXISTS public.marketplace_external_settlements_reference_once;
ALTER TABLE public.marketplace_external_settlements
  DROP CONSTRAINT IF EXISTS marketplace_external_settlements_evidence_check;
ALTER TABLE public.marketplace_external_settlements
  ALTER COLUMN evidence SET NOT NULL,
  ADD CONSTRAINT marketplace_external_settlements_evidence_check CHECK (length(btrim(evidence)) BETWEEN 8 AND 500);
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_external_settlements_proof_once
  ON public.marketplace_external_settlements (invoice_id, kind, evidence) WHERE kind IN ('receipt', 'refund');

DROP FUNCTION IF EXISTS public.marketplace_record_external_settlement(uuid, uuid, uuid, uuid, text, integer, text, text, text);
CREATE OR REPLACE FUNCTION public.marketplace_record_external_settlement(p_id uuid,p_invoice uuid,p_binder uuid,p_actor uuid,p_kind text,p_amount integer,p_evidence text) RETURNS void
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE i marketplace_binder_invoices%ROWTYPE; e marketplace_external_settlements%ROWTYPE; net bigint; disputed boolean;
BEGIN
  PERFORM marketplace_external_member(p_binder,p_actor);
  SELECT * INTO i FROM marketplace_binder_invoices WHERE id=p_invoice AND binder_id=p_binder FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice_not_found'; END IF;
  SELECT * INTO e FROM marketplace_external_settlements WHERE id=p_id;
  IF FOUND THEN
    IF e.invoice_id IS DISTINCT FROM p_invoice OR e.kind IS DISTINCT FROM p_kind OR e.amount_cents IS DISTINCT FROM p_amount
      OR e.evidence IS DISTINCT FROM btrim(p_evidence) OR e.actor_id IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
    RETURN;
  END IF;
  IF i.payment_snapshot->>'agreement_version' IS DISTINCT FROM 'own-external-v1' OR i.status NOT IN ('issued','credited') THEN
    RAISE EXCEPTION 'external_settlement_locked';
  END IF;
  SELECT coalesce(sum(CASE WHEN kind='receipt' THEN amount_cents WHEN kind='refund' THEN -amount_cents ELSE 0 END),0)
    INTO net FROM marketplace_external_settlements WHERE invoice_id=p_invoice;
  SELECT kind='dispute_open' INTO disputed FROM marketplace_external_settlements WHERE invoice_id=p_invoice AND kind IN ('dispute_open','dispute_close') ORDER BY created_at DESC,id DESC LIMIT 1;
  IF p_kind='receipt' AND (i.status<>'issued' OR coalesce(disputed,false) OR p_amount>i.total_ttc_cents-net
    OR EXISTS(SELECT 1 FROM marketplace_binder_credit_notes WHERE invoice_id=p_invoice)) THEN RAISE EXCEPTION 'receipt_not_due'; END IF;
  IF p_kind='refund' AND p_amount>net THEN RAISE EXCEPTION 'refund_exceeds_receipts'; END IF;
  IF (p_kind='dispute_open' AND coalesce(disputed,false)) OR (p_kind='dispute_close' AND NOT coalesce(disputed,false)) THEN RAISE EXCEPTION 'dispute_transition_invalid'; END IF;
  INSERT INTO marketplace_external_settlements VALUES(p_id,p_invoice,p_actor,p_kind,p_amount,i.currency,btrim(p_evidence),clock_timestamp());
  IF p_kind IN ('receipt','refund') THEN
    net := net + CASE WHEN p_kind='receipt' THEN p_amount ELSE -p_amount END;
    UPDATE marketplace_binder_invoices SET amount_paid_cents=net,
      payment_status=CASE WHEN net=0 THEN 'unpaid' WHEN net=total_ttc_cents THEN 'paid' ELSE 'partial' END,
      paid_at=CASE WHEN net=total_ttc_cents THEN now() ELSE NULL END WHERE id=p_invoice;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.marketplace_record_external_settlement(uuid, uuid, uuid, uuid, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_record_external_settlement(uuid, uuid, uuid, uuid, text, integer, text) TO service_role;

COMMIT;
