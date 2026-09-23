-- Conformité des factures : brouillon administratif, émission atomique,
-- snapshots complets, immutabilité et avoirs. Migration additive ; les pièces
-- historiques sont classées comme émises sans réécriture de leur contenu.

ALTER TABLE public.marketplace_binder_billing_profiles
  ADD COLUMN IF NOT EXISTS legal_form TEXT,
  ADD COLUMN IF NOT EXISTS share_capital TEXT,
  ADD COLUMN IF NOT EXISTS siren TEXT,
  ADD COLUMN IF NOT EXISTS vat_on_debits BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payment_delay_days INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS early_payment_discount_terms TEXT,
  ADD COLUMN IF NOT EXISTS late_penalty_terms TEXT,
  ADD COLUMN IF NOT EXISTS iban TEXT,
  ADD COLUMN IF NOT EXISTS credit_note_prefix TEXT NOT NULL DEFAULT 'A';

ALTER TABLE public.marketplace_binder_billing_profiles
  DROP CONSTRAINT IF EXISTS marketplace_binder_billing_profiles_payment_delay_check;
ALTER TABLE public.marketplace_binder_billing_profiles
  ADD CONSTRAINT marketplace_binder_billing_profiles_payment_delay_check
    CHECK (payment_delay_days IS NULL OR payment_delay_days BETWEEN 0 AND 365),
  DROP CONSTRAINT IF EXISTS marketplace_binder_billing_profiles_prefix_check;
ALTER TABLE public.marketplace_binder_billing_profiles
  ADD CONSTRAINT marketplace_binder_billing_profiles_prefix_check
    CHECK (quote_prefix ~ '^[A-Za-z0-9]{1,8}$' AND invoice_prefix ~ '^[A-Za-z0-9]{1,8}$'
      AND credit_note_prefix ~ '^[A-Za-z0-9]{1,8}$');

ALTER TABLE public.marketplace_binder_billing_profiles
  DROP CONSTRAINT IF EXISTS marketplace_binder_billing_profiles_vat_regime_check;
ALTER TABLE public.marketplace_binder_billing_profiles
  ADD CONSTRAINT marketplace_binder_billing_profiles_vat_regime_check
    CHECK (vat_regime IS NULL OR vat_regime IN ('FRANCHISE', 'VAT_LIABLE', 'EXEMPT'));

ALTER TABLE public.marketplace_binder_clients
  ADD COLUMN IF NOT EXISTS client_type TEXT,
  ADD COLUMN IF NOT EXISTS legal_name TEXT,
  ADD COLUMN IF NOT EXISTS billing_address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS billing_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS billing_city TEXT,
  ADD COLUMN IF NOT EXISTS billing_country TEXT,
  ADD COLUMN IF NOT EXISTS siren TEXT,
  ADD COLUMN IF NOT EXISTS vat_number TEXT,
  ADD COLUMN IF NOT EXISTS purchase_order_number TEXT,
  ADD COLUMN IF NOT EXISTS public_service_code TEXT,
  ADD COLUMN IF NOT EXISTS public_commitment_number TEXT;

ALTER TABLE public.marketplace_binder_clients
  DROP CONSTRAINT IF EXISTS marketplace_binder_clients_type_check;
ALTER TABLE public.marketplace_binder_clients
  ADD CONSTRAINT marketplace_binder_clients_type_check
    CHECK (client_type IN ('individual', 'business', 'public_entity'));

ALTER TABLE public.marketplace_binder_quotes
  DROP CONSTRAINT IF EXISTS marketplace_binder_quotes_vat_regime_check;
ALTER TABLE public.marketplace_binder_quotes
  ADD CONSTRAINT marketplace_binder_quotes_vat_regime_check
    CHECK (vat_regime IN ('FRANCHISE', 'VAT_LIABLE', 'EXEMPT'));

ALTER TABLE public.marketplace_binder_document_counters
  DROP CONSTRAINT IF EXISTS marketplace_binder_document_counters_kind_check;
ALTER TABLE public.marketplace_binder_document_counters
  ADD CONSTRAINT marketplace_binder_document_counters_kind_check CHECK (kind IN ('quote', 'invoice', 'credit_note'));

-- Retirer temporairement le verrou historique afin d'initialiser les colonnes
-- des pièces déjà émises. Leur contenu métier reste strictement inchangé.
DROP TRIGGER IF EXISTS marketplace_binder_invoices_immutable ON public.marketplace_binder_invoices;
DROP TRIGGER IF EXISTS marketplace_binder_invoice_items_immutable ON public.marketplace_binder_invoice_items;

ALTER TABLE public.marketplace_binder_invoices
  ALTER COLUMN invoice_number DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'issued',
  ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS service_date DATE,
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS operation_nature TEXT,
  ADD COLUMN IF NOT EXISTS client_type TEXT,
  ADD COLUMN IF NOT EXISTS client_legal_name TEXT,
  ADD COLUMN IF NOT EXISTS client_billing_address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS client_billing_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS client_billing_city TEXT,
  ADD COLUMN IF NOT EXISTS client_billing_country TEXT,
  ADD COLUMN IF NOT EXISTS client_siren TEXT,
  ADD COLUMN IF NOT EXISTS client_vat_number TEXT,
  ADD COLUMN IF NOT EXISTS client_purchase_order_number TEXT,
  ADD COLUMN IF NOT EXISTS client_public_service_code TEXT,
  ADD COLUMN IF NOT EXISTS client_public_commitment_number TEXT,
  ADD COLUMN IF NOT EXISTS delivery_address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS delivery_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS delivery_city TEXT,
  ADD COLUMN IF NOT EXISTS delivery_country TEXT,
  ADD COLUMN IF NOT EXISTS early_payment_discount_terms TEXT,
  ADD COLUMN IF NOT EXISTS late_penalty_terms TEXT,
  ADD COLUMN IF NOT EXISTS recovery_fee_cents INTEGER NOT NULL DEFAULT 4000,
  ADD COLUMN IF NOT EXISTS legal_mentions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS electronic_invoice_provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_status TEXT,
  ADD COLUMN IF NOT EXISTS provider_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS structured_invoice_format TEXT,
  ADD COLUMN IF NOT EXISTS reporting_status TEXT,
  ADD COLUMN IF NOT EXISTS retained_until DATE;

UPDATE public.marketplace_binder_invoices
SET issued_at = COALESCE(issued_at, created_at),
    service_date = COALESCE(service_date, issue_date),
    due_date = COALESCE(due_date, issue_date),
    operation_nature = COALESCE(operation_nature, 'services'),
    retained_until = COALESCE(retained_until, (date_trunc('year', issue_date) + interval '10 years 1 year - 1 day')::date)
WHERE status = 'issued';

ALTER TABLE public.marketplace_binder_invoices
  DROP CONSTRAINT IF EXISTS marketplace_binder_invoices_status_check,
  DROP CONSTRAINT IF EXISTS marketplace_binder_invoices_number_by_status_check,
  DROP CONSTRAINT IF EXISTS marketplace_binder_invoices_client_type_check,
  DROP CONSTRAINT IF EXISTS marketplace_binder_invoices_operation_nature_check,
  DROP CONSTRAINT IF EXISTS marketplace_binder_invoices_structured_format_check,
  DROP CONSTRAINT IF EXISTS marketplace_binder_invoices_recovery_fee_check;
ALTER TABLE public.marketplace_binder_invoices
  ADD CONSTRAINT marketplace_binder_invoices_status_check CHECK (status IN ('draft', 'issued', 'credited')),
  ADD CONSTRAINT marketplace_binder_invoices_number_by_status_check
    CHECK ((status = 'draft' AND invoice_number IS NULL AND issued_at IS NULL)
      OR (status IN ('issued', 'credited') AND invoice_number IS NOT NULL AND issued_at IS NOT NULL)),
  ADD CONSTRAINT marketplace_binder_invoices_client_type_check
    CHECK (client_type IN ('individual', 'business', 'public_entity')),
  ADD CONSTRAINT marketplace_binder_invoices_operation_nature_check
    CHECK (operation_nature IS NULL OR operation_nature IN ('goods', 'services', 'mixed')),
  ADD CONSTRAINT marketplace_binder_invoices_structured_format_check
    CHECK (structured_invoice_format IS NULL OR structured_invoice_format IN ('factur-x', 'ubl', 'cii')),
  ADD CONSTRAINT marketplace_binder_invoices_recovery_fee_check CHECK (recovery_fee_cents >= 0);
ALTER TABLE public.marketplace_binder_invoices
  DROP CONSTRAINT IF EXISTS marketplace_binder_invoices_vat_regime_check;
ALTER TABLE public.marketplace_binder_invoices
  ADD CONSTRAINT marketplace_binder_invoices_vat_regime_check
    CHECK (vat_regime IN ('FRANCHISE', 'VAT_LIABLE', 'EXEMPT'));

-- Une facture émise ne change plus. Les seuls champs postérieurs autorisés
-- concernent paiement et acheminement électronique, jamais la pièce elle-même.
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

CREATE TRIGGER marketplace_binder_invoices_immutable
  BEFORE UPDATE ON public.marketplace_binder_invoices
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_binder_invoices_forbid_content_change();

CREATE OR REPLACE FUNCTION public.marketplace_binder_invoices_forbid_delete()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status IN ('issued', 'credited') THEN
    RAISE EXCEPTION 'issued invoices cannot be deleted (invoice %)', OLD.id;
  END IF;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS marketplace_binder_invoices_no_delete ON public.marketplace_binder_invoices;
CREATE TRIGGER marketplace_binder_invoices_no_delete
  BEFORE DELETE ON public.marketplace_binder_invoices
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_binder_invoices_forbid_delete();

CREATE OR REPLACE FUNCTION public.marketplace_binder_invoice_items_forbid_change()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM public.marketplace_binder_invoices WHERE id = OLD.invoice_id;
  IF v_status IN ('issued', 'credited') THEN
    RAISE EXCEPTION 'marketplace_binder_invoice_items is immutable after issue (item %)', OLD.id;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
CREATE TRIGGER marketplace_binder_invoice_items_immutable
  BEFORE UPDATE OR DELETE ON public.marketplace_binder_invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_binder_invoice_items_forbid_change();

-- Le brouillon reprend le devis accepté sans consommer de numéro.
DROP FUNCTION IF EXISTS public.marketplace_binder_convert_quote_to_invoice(UUID, UUID, DATE, TEXT, JSONB, TEXT);
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

CREATE OR REPLACE FUNCTION public.marketplace_binder_update_invoice_draft(
  p_binder_id UUID, p_invoice_id UUID, p_draft JSONB
) RETURNS UUID LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.marketplace_binder_invoices SET
    issue_date = (p_draft->>'issue_date')::date,
    service_date = (p_draft->>'service_date')::date,
    due_date = (p_draft->>'due_date')::date,
    operation_nature = p_draft->>'operation_nature',
    client_type = p_draft->>'client_type', client_name = p_draft->>'client_name',
    client_legal_name = p_draft->>'client_legal_name', client_email = p_draft->>'client_email',
    client_phone = p_draft->>'client_phone', client_address_line1 = p_draft->>'client_address_line1',
    client_postal_code = p_draft->>'client_postal_code', client_city = p_draft->>'client_city',
    client_country = p_draft->>'client_country',
    client_billing_address_line1 = p_draft->>'client_billing_address_line1',
    client_billing_postal_code = p_draft->>'client_billing_postal_code',
    client_billing_city = p_draft->>'client_billing_city', client_billing_country = p_draft->>'client_billing_country',
    client_siren = p_draft->>'client_siren', client_vat_number = p_draft->>'client_vat_number',
    client_purchase_order_number = p_draft->>'client_purchase_order_number',
    client_public_service_code = p_draft->>'client_public_service_code',
    client_public_commitment_number = p_draft->>'client_public_commitment_number',
    delivery_address_line1 = p_draft->>'delivery_address_line1',
    delivery_postal_code = p_draft->>'delivery_postal_code', delivery_city = p_draft->>'delivery_city',
    delivery_country = p_draft->>'delivery_country', issuer = p_draft->'issuer',
    vat_mention = p_draft->>'vat_mention', payment_terms = p_draft->>'payment_terms',
    early_payment_discount_terms = p_draft->>'early_payment_discount_terms',
    late_penalty_terms = p_draft->>'late_penalty_terms', notes = p_draft->>'notes', updated_at = now()
  WHERE id = p_invoice_id AND binder_id = p_binder_id AND status = 'draft';
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice_draft_not_found'; END IF;
  RETURN p_invoice_id;
END;
$$;

-- Le verrou de ligne rend une double émission idempotente. Le compteur et la
-- pièce sont modifiés dans la même transaction : aucun numéro n'est perdu.
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
    retained_until = (date_trunc('year', issue_date) + interval '10 years 1 year - 1 day')::date,
    updated_at = now()
  WHERE id = p_invoice_id;
  UPDATE public.marketplace_binder_quotes SET status = 'invoiced' WHERE id = v_invoice.quote_id;
  RETURN p_invoice_id;
END;
$$;

-- Les avoirs sont des pièces distinctes, rattachées à une facture émise.
CREATE TABLE IF NOT EXISTS public.marketplace_binder_credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  binder_id UUID NOT NULL REFERENCES public.marketplace_binders(id) ON DELETE RESTRICT,
  invoice_id UUID NOT NULL REFERENCES public.marketplace_binder_invoices(id) ON DELETE RESTRICT,
  credit_note_number TEXT NOT NULL,
  issue_date DATE NOT NULL,
  reason TEXT NOT NULL,
  issuer JSONB NOT NULL,
  client JSONB NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  total_ht_cents INTEGER NOT NULL,
  total_vat_cents INTEGER NOT NULL,
  total_ttc_cents INTEGER NOT NULL,
  vat_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  legal_mentions JSONB NOT NULL DEFAULT '[]'::jsonb,
  retained_until DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (binder_id, credit_note_number)
);
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_binder_credit_notes_full_invoice_uidx
  ON public.marketplace_binder_credit_notes(invoice_id);

CREATE TABLE IF NOT EXISTS public.marketplace_binder_credit_note_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id UUID NOT NULL REFERENCES public.marketplace_binder_credit_notes(id) ON DELETE RESTRICT,
  binder_id UUID NOT NULL REFERENCES public.marketplace_binders(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL, label TEXT NOT NULL, description TEXT, unit TEXT,
  quantity NUMERIC(10,2) NOT NULL, unit_price_cents INTEGER NOT NULL,
  vat_rate_bps INTEGER NOT NULL, total_ht_cents INTEGER NOT NULL
);

CREATE OR REPLACE FUNCTION public.marketplace_binder_credit_notes_immutable()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$ BEGIN
  RAISE EXCEPTION 'credit notes are immutable';
END; $$;
CREATE TRIGGER marketplace_binder_credit_notes_immutable
  BEFORE UPDATE OR DELETE ON public.marketplace_binder_credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_binder_credit_notes_immutable();
CREATE TRIGGER marketplace_binder_credit_note_items_immutable
  BEFORE UPDATE OR DELETE ON public.marketplace_binder_credit_note_items
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_binder_credit_notes_immutable();

CREATE OR REPLACE FUNCTION public.marketplace_binder_create_full_credit_note(
  p_binder_id UUID, p_invoice_id UUID, p_issue_date DATE, p_reason TEXT
) RETURNS UUID LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_invoice public.marketplace_binder_invoices%ROWTYPE;
  v_existing UUID;
  v_id UUID := gen_random_uuid();
  v_seq INTEGER;
  v_prefix TEXT;
  v_number TEXT;
BEGIN
  SELECT id INTO v_existing FROM public.marketplace_binder_credit_notes
  WHERE invoice_id = p_invoice_id AND binder_id = p_binder_id;
  IF FOUND THEN RETURN v_existing; END IF;

  SELECT * INTO v_invoice FROM public.marketplace_binder_invoices
  WHERE id = p_invoice_id AND binder_id = p_binder_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice_not_found'; END IF;
  IF v_invoice.status <> 'issued' THEN RAISE EXCEPTION 'invoice_not_issued'; END IF;
  IF NULLIF(btrim(p_reason), '') IS NULL THEN RAISE EXCEPTION 'credit_note_reason_required'; END IF;

  INSERT INTO public.marketplace_binder_document_counters AS c (binder_id, kind, year, last_value)
  VALUES (p_binder_id, 'credit_note', EXTRACT(YEAR FROM p_issue_date)::integer, 1)
  ON CONFLICT (binder_id, kind, year) DO UPDATE SET last_value = c.last_value + 1
  RETURNING c.last_value INTO v_seq;
  SELECT credit_note_prefix INTO v_prefix FROM public.marketplace_binder_billing_profiles WHERE binder_id = p_binder_id;
  v_number := COALESCE(v_prefix, 'A') || '-' || EXTRACT(YEAR FROM p_issue_date)::integer::text || '-' || lpad(v_seq::text, 4, '0');

  INSERT INTO public.marketplace_binder_credit_notes (
    id, binder_id, invoice_id, credit_note_number, issue_date, reason, issuer, client,
    currency, total_ht_cents, total_vat_cents, total_ttc_cents, vat_breakdown,
    legal_mentions, retained_until
  ) VALUES (
    v_id, p_binder_id, p_invoice_id, v_number, p_issue_date, btrim(p_reason), v_invoice.issuer,
    jsonb_build_object('type', v_invoice.client_type, 'name', v_invoice.client_name,
      'legalName', v_invoice.client_legal_name, 'addressLine1', v_invoice.client_billing_address_line1,
      'postalCode', v_invoice.client_billing_postal_code, 'city', v_invoice.client_billing_city,
      'country', v_invoice.client_billing_country, 'siren', v_invoice.client_siren,
      'vatNumber', v_invoice.client_vat_number),
    v_invoice.currency, v_invoice.total_ht_cents, v_invoice.total_vat_cents, v_invoice.total_ttc_cents,
    v_invoice.vat_breakdown, v_invoice.legal_mentions,
    (date_trunc('year', p_issue_date) + interval '10 years 1 year - 1 day')::date
  );
  INSERT INTO public.marketplace_binder_credit_note_items (
    credit_note_id, binder_id, position, label, description, unit, quantity,
    unit_price_cents, vat_rate_bps, total_ht_cents
  ) SELECT v_id, binder_id, position, label, description, unit, quantity,
    unit_price_cents, vat_rate_bps, total_ht_cents
  FROM public.marketplace_binder_invoice_items WHERE invoice_id = p_invoice_id ORDER BY position;
  RETURN v_id;
END;
$$;

GRANT ALL ON public.marketplace_binder_credit_notes TO service_role;
GRANT ALL ON public.marketplace_binder_credit_note_items TO service_role;
ALTER TABLE public.marketplace_binder_credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_binder_credit_note_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access to marketplace_binder_credit_notes" ON public.marketplace_binder_credit_notes
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No direct access to marketplace_binder_credit_note_items" ON public.marketplace_binder_credit_note_items
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

REVOKE ALL ON FUNCTION public.marketplace_binder_create_invoice_draft(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marketplace_binder_update_invoice_draft(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marketplace_binder_issue_invoice(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_binder_create_invoice_draft(UUID, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.marketplace_binder_update_invoice_draft(UUID, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.marketplace_binder_issue_invoice(UUID, UUID, JSONB) TO service_role;
REVOKE ALL ON FUNCTION public.marketplace_binder_create_full_credit_note(UUID, UUID, DATE, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_binder_create_full_credit_note(UUID, UUID, DATE, TEXT) TO service_role;
