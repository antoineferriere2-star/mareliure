-- Phase 0 / P1-8 — la mention de franchise en base de TVA est figée dans la facture.
--
-- Défaut corrigé : un devis peut naître en régime FRANCHISE SANS mention (un devis se chiffre sans
-- administratif). L'atelier complète ensuite son profil, le devis est accepté, puis converti :
-- le serveur validait la facture avec la mention du PROFIL, mais la fonction SQL recopiait
-- `v_quote.vat_mention` — NULL. Résultat : une facture en franchise sans mention légale.
--
-- Après : le serveur transmet la mention effective (`p_vat_mention`) ; en FRANCHISE la fonction fige
-- la mention non blanche du devis, à défaut celle transmise, et REFUSE (`vat_mention_required`,
-- avant toute consommation de numéro) s'il n'y en a aucune. Même règle que `effectiveVatMention`
-- côté TypeScript. Hors franchise, rien ne change.
--
-- Additive et rejouable. Le sixième argument a une valeur par défaut : un appelant qui ne l'envoie pas
-- (ancien serveur) reste valide — il est simplement refusé si le devis est en franchise sans mention.
-- La fonction est recréée (pas modifiée sur place) : la migration 20260919090000, déjà appliquée, n'est
-- pas éditée. Rollback : rejouer la définition de 20260919090000 (5 arguments) après un DROP de celle-ci.

DROP FUNCTION IF EXISTS public.marketplace_binder_convert_quote_to_invoice(UUID, UUID, DATE, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.marketplace_binder_convert_quote_to_invoice(
  p_binder_id UUID,
  p_quote_id UUID,
  p_issue_date DATE,
  p_invoice_notes TEXT,
  p_issuer JSONB,
  -- Mention de TVA effective calculée par le serveur (devis, à défaut profil). Facultative.
  p_vat_mention TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_quote public.marketplace_binder_quotes%ROWTYPE;
  v_id UUID := gen_random_uuid();
  v_number TEXT;
  v_vat_mention TEXT;
BEGIN
  SELECT * INTO v_quote
  FROM public.marketplace_binder_quotes
  WHERE id = p_quote_id AND binder_id = p_binder_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'quote_not_found'; END IF;
  IF v_quote.status = 'invoiced' THEN RAISE EXCEPTION 'quote_already_invoiced'; END IF;
  IF v_quote.status <> 'accepted' THEN RAISE EXCEPTION 'quote_not_accepted'; END IF;

  IF v_quote.vat_regime = 'FRANCHISE' THEN
    v_vat_mention := COALESCE(NULLIF(btrim(v_quote.vat_mention), ''), NULLIF(btrim(p_vat_mention), ''));
    -- Une facture en franchise sans sa mention n'est pas émise : ni numéro consommé, ni facture.
    IF v_vat_mention IS NULL THEN RAISE EXCEPTION 'vat_mention_required'; END IF;
  ELSE
    v_vat_mention := v_quote.vat_mention;
  END IF;

  v_number := public.marketplace_binder_next_document_number(
    p_binder_id, 'invoice', EXTRACT(YEAR FROM p_issue_date)::INTEGER
  );

  INSERT INTO public.marketplace_binder_invoices (
    id, binder_id, quote_id, client_id, invoice_number, issue_date,
    client_name, client_email, client_phone, client_address_line1,
    client_postal_code, client_city, client_country,
    book_title, book_author, height_mm, width_mm, spine_mm, book_notes,
    currency, issuer, vat_regime, vat_mention, payment_terms, notes,
    subtotal_cents, discount_type, discount_value, discount_cents,
    total_ht_cents, total_vat_cents, total_ttc_cents, vat_breakdown,
    deposit_type, deposit_value, deposit_cents
  ) VALUES (
    v_id, p_binder_id, p_quote_id, v_quote.client_id, v_number, p_issue_date,
    v_quote.client_name, v_quote.client_email, v_quote.client_phone, v_quote.client_address_line1,
    v_quote.client_postal_code, v_quote.client_city, v_quote.client_country,
    v_quote.book_title, v_quote.book_author, v_quote.height_mm, v_quote.width_mm, v_quote.spine_mm,
    v_quote.book_notes,
    v_quote.currency, COALESCE(p_issuer, v_quote.issuer), v_quote.vat_regime, v_vat_mention, v_quote.payment_terms,
    p_invoice_notes,
    v_quote.subtotal_cents, v_quote.discount_type, v_quote.discount_value, v_quote.discount_cents,
    v_quote.total_ht_cents, v_quote.total_vat_cents, v_quote.total_ttc_cents, v_quote.vat_breakdown,
    v_quote.deposit_type, v_quote.deposit_value, v_quote.deposit_cents
  );

  INSERT INTO public.marketplace_binder_invoice_items (
    invoice_id, binder_id, position, service_id, label, description, unit,
    quantity, unit_price_cents, vat_rate_bps, total_ht_cents
  )
  SELECT v_id, binder_id, position, service_id, label, description, unit,
         quantity, unit_price_cents, vat_rate_bps, total_ht_cents
  FROM public.marketplace_binder_quote_items
  WHERE quote_id = p_quote_id AND binder_id = p_binder_id
  ORDER BY position;

  UPDATE public.marketplace_binder_quotes SET status = 'invoiced' WHERE id = p_quote_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.marketplace_binder_convert_quote_to_invoice(UUID, UUID, DATE, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_binder_convert_quote_to_invoice(UUID, UUID, DATE, TEXT, JSONB, TEXT) TO service_role;
