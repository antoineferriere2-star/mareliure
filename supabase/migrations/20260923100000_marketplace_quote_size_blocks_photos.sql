-- Blocs tarifaires par format et photos d'exemple des opérations.
--
-- Les métadonnées du bloc sont figées sur chaque ligne. Cela garde le document
-- autonome et permet aux anciennes lignes de devenir un « Format principal »
-- sans réécrire leurs montants. `line_key` est l'identité stable d'une ligne
-- pendant l'édition d'un brouillon ; les fonctions transactionnelles peuvent
-- donc recréer les lignes sans perdre leurs photos.

ALTER TABLE public.marketplace_binder_quote_items
  ADD COLUMN IF NOT EXISTS line_key TEXT,
  ADD COLUMN IF NOT EXISTS block_key TEXT NOT NULL DEFAULT 'format-principal',
  ADD COLUMN IF NOT EXISTS block_label TEXT NOT NULL DEFAULT 'Format principal',
  ADD COLUMN IF NOT EXISTS block_book_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS block_height_mm INTEGER,
  ADD COLUMN IF NOT EXISTS block_width_mm INTEGER,
  ADD COLUMN IF NOT EXISTS block_spine_mm INTEGER;

UPDATE public.marketplace_binder_quote_items i SET
  line_key = COALESCE(i.line_key, i.id::TEXT),
  block_height_mm = COALESCE(i.block_height_mm, q.height_mm),
  block_width_mm = COALESCE(i.block_width_mm, q.width_mm),
  block_spine_mm = COALESCE(i.block_spine_mm, q.spine_mm)
FROM public.marketplace_binder_quotes q
WHERE q.id = i.quote_id AND i.line_key IS NULL;

ALTER TABLE public.marketplace_binder_quote_items ALTER COLUMN line_key SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_binder_quote_items_line_key_uidx
  ON public.marketplace_binder_quote_items(quote_id, line_key);
ALTER TABLE public.marketplace_binder_quote_items
  DROP CONSTRAINT IF EXISTS marketplace_binder_quote_items_block_values_check;
ALTER TABLE public.marketplace_binder_quote_items
  ADD CONSTRAINT marketplace_binder_quote_items_block_values_check CHECK (
    btrim(line_key) <> '' AND btrim(block_key) <> '' AND btrim(block_label) <> ''
    AND block_book_count BETWEEN 1 AND 10000
    AND (block_height_mm IS NULL OR block_height_mm BETWEEN 1 AND 2000)
    AND (block_width_mm IS NULL OR block_width_mm BETWEEN 1 AND 2000)
    AND (block_spine_mm IS NULL OR block_spine_mm BETWEEN 1 AND 2000)
  );

ALTER TABLE public.marketplace_binder_invoice_items
  ADD COLUMN IF NOT EXISTS line_key TEXT,
  ADD COLUMN IF NOT EXISTS block_key TEXT NOT NULL DEFAULT 'format-principal',
  ADD COLUMN IF NOT EXISTS block_label TEXT NOT NULL DEFAULT 'Format principal',
  ADD COLUMN IF NOT EXISTS block_book_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS block_height_mm INTEGER,
  ADD COLUMN IF NOT EXISTS block_width_mm INTEGER,
  ADD COLUMN IF NOT EXISTS block_spine_mm INTEGER;

-- Les lignes de facture sont immuables en exploitation. Le backfill ajoute
-- uniquement les clés et dimensions de bloc à leurs snapshots existants.
-- La désactivation est locale à la transaction de migration : toute erreur
-- annule aussi ce changement, et le trigger est réactivé avant la suite.
ALTER TABLE public.marketplace_binder_invoice_items
  DISABLE TRIGGER marketplace_binder_invoice_items_immutable;

UPDATE public.marketplace_binder_invoice_items i SET
  line_key = COALESCE(i.line_key, i.id::TEXT),
  block_height_mm = COALESCE(i.block_height_mm, q.height_mm),
  block_width_mm = COALESCE(i.block_width_mm, q.width_mm),
  block_spine_mm = COALESCE(i.block_spine_mm, q.spine_mm)
FROM public.marketplace_binder_invoices q
WHERE q.id = i.invoice_id AND i.line_key IS NULL;

ALTER TABLE public.marketplace_binder_invoice_items
  ENABLE TRIGGER marketplace_binder_invoice_items_immutable;

ALTER TABLE public.marketplace_binder_invoice_items ALTER COLUMN line_key SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_binder_invoice_items_line_key_uidx
  ON public.marketplace_binder_invoice_items(invoice_id, line_key);

CREATE TABLE IF NOT EXISTS public.marketplace_binder_quote_item_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.marketplace_binder_quotes(id) ON DELETE CASCADE,
  binder_id UUID NOT NULL REFERENCES public.marketplace_binders(id) ON DELETE RESTRICT,
  line_key TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  caption TEXT,
  include_in_pdf BOOLEAN NOT NULL DEFAULT TRUE,
  position INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_binder_quote_item_photos_position_check CHECK (position BETWEEN 1 AND 20),
  CONSTRAINT marketplace_binder_quote_item_photos_line_fkey
    FOREIGN KEY (quote_id, line_key)
    REFERENCES public.marketplace_binder_quote_items(quote_id, line_key)
    DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX IF NOT EXISTS marketplace_binder_quote_item_photos_quote_idx
  ON public.marketplace_binder_quote_item_photos(quote_id, line_key, position);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('marketplace-quote-operation-photos', 'marketplace-quote-operation-photos', FALSE, 8388608,
        ARRAY['image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "No direct access to marketplace-quote-operation-photos" ON storage.objects;
CREATE POLICY "No direct access to marketplace-quote-operation-photos"
  ON storage.objects FOR ALL TO anon, authenticated
  USING (bucket_id = 'marketplace-quote-operation-photos' AND FALSE)
  WITH CHECK (bucket_id = 'marketplace-quote-operation-photos' AND FALSE);

GRANT ALL ON public.marketplace_binder_quote_item_photos TO service_role;
ALTER TABLE public.marketplace_binder_quote_item_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to marketplace_binder_quote_item_photos" ON public.marketplace_binder_quote_item_photos;
CREATE POLICY "No direct access to marketplace_binder_quote_item_photos"
  ON public.marketplace_binder_quote_item_photos FOR ALL TO anon, authenticated
  USING (FALSE) WITH CHECK (FALSE);

-- L'UPDATE historique recrée les lignes. La clé stable les rattache au même
-- bloc et les photos dont la ligne a réellement disparu sont retirées.
CREATE OR REPLACE FUNCTION public.marketplace_binder_update_quote(
  p_binder_id UUID, p_quote_id UUID, p_quote JSONB, p_items JSONB
) RETURNS UUID
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM public.marketplace_binder_quotes
  WHERE id = p_quote_id AND binder_id = p_binder_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'quote_not_found'; END IF;
  IF v_status <> 'draft' THEN RAISE EXCEPTION 'quote_not_editable'; END IF;

  UPDATE public.marketplace_binder_quotes q SET
    client_id = r.client_id, valid_until = r.valid_until,
    client_name = r.client_name, client_email = r.client_email, client_phone = r.client_phone,
    client_address_line1 = r.client_address_line1, client_postal_code = r.client_postal_code,
    client_city = r.client_city, client_country = r.client_country,
    book_title = r.book_title, book_author = r.book_author,
    height_mm = r.height_mm, width_mm = r.width_mm, spine_mm = r.spine_mm, book_notes = r.book_notes,
    issuer = r.issuer, vat_regime = r.vat_regime, vat_mention = r.vat_mention,
    payment_terms = r.payment_terms, notes = r.notes,
    subtotal_cents = r.subtotal_cents, discount_type = r.discount_type,
    discount_value = r.discount_value, discount_cents = r.discount_cents,
    total_ht_cents = r.total_ht_cents, total_vat_cents = r.total_vat_cents,
    total_ttc_cents = r.total_ttc_cents, vat_breakdown = r.vat_breakdown,
    deposit_type = r.deposit_type, deposit_value = r.deposit_value, deposit_cents = r.deposit_cents,
    updated_at = now()
  FROM jsonb_populate_record(NULL::public.marketplace_binder_quotes, p_quote) AS r
  WHERE q.id = p_quote_id AND q.binder_id = p_binder_id;

  DELETE FROM public.marketplace_binder_quote_items
  WHERE quote_id = p_quote_id AND binder_id = p_binder_id;
  INSERT INTO public.marketplace_binder_quote_items
  SELECT r.* FROM jsonb_array_elements(p_items) WITH ORDINALITY AS e(item, ord),
    LATERAL jsonb_populate_record(NULL::public.marketplace_binder_quote_items,
      e.item || jsonb_build_object('id', gen_random_uuid(), 'quote_id', p_quote_id,
        'binder_id', p_binder_id, 'position', e.ord)) AS r;

  DELETE FROM public.marketplace_binder_quote_item_photos p
  WHERE p.quote_id = p_quote_id AND p.binder_id = p_binder_id
    AND NOT EXISTS (SELECT 1 FROM public.marketplace_binder_quote_items i
      WHERE i.quote_id = p.quote_id AND i.line_key = p.line_key);
  RETURN p_quote_id;
END;
$$;

DROP FUNCTION IF EXISTS public.marketplace_binder_convert_quote_to_invoice(UUID, UUID, DATE, TEXT, JSONB, TEXT);
CREATE OR REPLACE FUNCTION public.marketplace_binder_convert_quote_to_invoice(
  p_binder_id UUID, p_quote_id UUID, p_issue_date DATE, p_invoice_notes TEXT,
  p_issuer JSONB, p_vat_mention TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_quote public.marketplace_binder_quotes%ROWTYPE;
  v_id UUID := gen_random_uuid();
  v_number TEXT;
  v_vat_mention TEXT;
BEGIN
  SELECT * INTO v_quote FROM public.marketplace_binder_quotes
  WHERE id = p_quote_id AND binder_id = p_binder_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'quote_not_found'; END IF;
  IF v_quote.status = 'invoiced' THEN RAISE EXCEPTION 'quote_already_invoiced'; END IF;
  IF v_quote.status <> 'accepted' THEN RAISE EXCEPTION 'quote_not_accepted'; END IF;
  IF v_quote.vat_regime = 'FRANCHISE' THEN
    v_vat_mention := COALESCE(NULLIF(btrim(v_quote.vat_mention), ''), NULLIF(btrim(p_vat_mention), ''));
    IF v_vat_mention IS NULL THEN RAISE EXCEPTION 'vat_mention_required'; END IF;
  ELSE v_vat_mention := v_quote.vat_mention; END IF;
  v_number := public.marketplace_binder_next_document_number(
    p_binder_id, 'invoice', EXTRACT(YEAR FROM p_issue_date)::INTEGER);

  INSERT INTO public.marketplace_binder_invoices (
    id, binder_id, quote_id, client_id, invoice_number, issue_date,
    client_name, client_email, client_phone, client_address_line1, client_postal_code, client_city, client_country,
    book_title, book_author, height_mm, width_mm, spine_mm, book_notes,
    currency, issuer, vat_regime, vat_mention, payment_terms, notes,
    subtotal_cents, discount_type, discount_value, discount_cents,
    total_ht_cents, total_vat_cents, total_ttc_cents, vat_breakdown,
    deposit_type, deposit_value, deposit_cents
  ) VALUES (
    v_id, p_binder_id, p_quote_id, v_quote.client_id, v_number, p_issue_date,
    v_quote.client_name, v_quote.client_email, v_quote.client_phone, v_quote.client_address_line1,
    v_quote.client_postal_code, v_quote.client_city, v_quote.client_country,
    v_quote.book_title, v_quote.book_author, v_quote.height_mm, v_quote.width_mm, v_quote.spine_mm, v_quote.book_notes,
    v_quote.currency, COALESCE(p_issuer, v_quote.issuer), v_quote.vat_regime, v_vat_mention,
    v_quote.payment_terms, p_invoice_notes,
    v_quote.subtotal_cents, v_quote.discount_type, v_quote.discount_value, v_quote.discount_cents,
    v_quote.total_ht_cents, v_quote.total_vat_cents, v_quote.total_ttc_cents, v_quote.vat_breakdown,
    v_quote.deposit_type, v_quote.deposit_value, v_quote.deposit_cents
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
  UPDATE public.marketplace_binder_quotes SET status = 'invoiced' WHERE id = p_quote_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.marketplace_binder_update_quote(UUID, UUID, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_binder_update_quote(UUID, UUID, JSONB, JSONB) TO service_role;
REVOKE ALL ON FUNCTION public.marketplace_binder_convert_quote_to_invoice(UUID, UUID, DATE, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_binder_convert_quote_to_invoice(UUID, UUID, DATE, TEXT, JSONB, TEXT) TO service_role;
