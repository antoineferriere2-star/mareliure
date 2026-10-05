-- TVA des devis Oppe (modèle du 5 octobre 2026) : qualification et taux PAR LIGNE, jamais un taux
-- unique présumé.
--
-- Le taux dépend de la nature de l'opération et de l'ouvrage (BOI-TVA-LIQ-30-10-40 : reliure d'un livre
-- au sens fiscal, réparation, accessoires…), pas du vendeur. Un devis Oppe ne peut donc être validé
-- fiscalement que par une décision d'administration qui qualifie la prestation, fixe le taux de la
-- ligne de prestation et celui de la ligne de transport, et la justifie. La règle automatique
-- « France = 20 % » reste valable pour l'historique, mais ne s'applique plus aux nouveaux devis.
--
-- Aucune facture ni proposition existante n'est modifiée.

ALTER TABLE public.marketplace_commercial_proposals
  ADD COLUMN shipping_vat_rate_bps integer CHECK (shipping_vat_rate_bps IS NULL OR shipping_vat_rate_bps BETWEEN 0 AND 3000),
  ADD COLUMN service_tax_category text CHECK (service_tax_category IS NULL OR service_tax_category IN
    ('book_binding', 'book_repair_restoration', 'non_book_object')),
  ADD COLUMN tax_justification text;

-- Le forfait de transport à 15 € TTC suppose 20 % SUR SA LIGNE (12,50 € HT) ; le service peut avoir son propre taux.
ALTER TABLE public.marketplace_commercial_proposals DROP CONSTRAINT marketplace_round_trip_offer_check;
ALTER TABLE public.marketplace_commercial_proposals ADD CONSTRAINT marketplace_round_trip_offer_check CHECK (
  shipping_offer_kind = 'manual' OR (
    shipping_offer_kind = 'book_round_trip_fr'
    AND shipping_total_cents = 1250
    AND shipping_other_cents = 1250
    AND shipping_outbound_cents = 0
    AND shipping_return_cents = 0
    AND currency = 'EUR'
    AND payment_circuit = 'legacy_resale'
    AND deposit_type = 'NONE'
    AND (
      (shipping_vat_rate_bps IS NULL
        AND (customer_vat_rate_bps IS NULL OR (customer_vat_rate_bps = 2000 AND tax_country = 'FR'))
        AND (accepted_at IS NULL OR (customer_vat_rate_bps = 2000 AND customer_total_ttc_cents IS NOT NULL)))
      OR
      (shipping_vat_rate_bps = 2000
        AND (tax_country IS NULL OR tax_country = 'FR')
        AND (accepted_at IS NULL OR customer_total_ttc_cents IS NOT NULL))
    )
  )
);

-- Validation fiscale d'un devis Oppe : qualification, taux de chaque ligne, justification, montants cohérents.
CREATE FUNCTION public.marketplace_guard_oppe_tax_validation() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_service_vat integer; v_shipping_vat integer; v_ship_rate integer;
BEGIN
  IF NEW.contract_version IS NULL OR NEW.tax_validated_at IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.tax_validated_at IS NOT NULL
     AND NEW.tax_validated_at IS NOT DISTINCT FROM OLD.tax_validated_at THEN RETURN NEW; END IF;
  IF NEW.tax_validation_source IS DISTINCT FROM 'manual_admin_review' THEN
    RAISE EXCEPTION 'oppe_tax_requires_manual_validation' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.service_tax_category IS NULL OR NEW.customer_vat_rate_bps IS NULL THEN
    RAISE EXCEPTION 'oppe_tax_category_required' USING ERRCODE = 'check_violation';
  END IF;
  IF length(btrim(coalesce(NEW.tax_justification, ''))) < 12 THEN
    RAISE EXCEPTION 'oppe_tax_justification_required' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.shipping_total_cents > 0 AND NEW.shipping_vat_rate_bps IS NULL THEN
    RAISE EXCEPTION 'oppe_tax_shipping_rate_required' USING ERRCODE = 'check_violation';
  END IF;
  v_ship_rate := coalesce(NEW.shipping_vat_rate_bps, NEW.customer_vat_rate_bps);
  v_service_vat := round(NEW.customer_service_price_cents::numeric * NEW.customer_vat_rate_bps / 10000)::integer;
  v_shipping_vat := round(NEW.shipping_total_cents::numeric * v_ship_rate / 10000)::integer;
  IF NEW.customer_vat_amount_cents IS DISTINCT FROM v_service_vat + v_shipping_vat
     OR NEW.customer_total_ttc_cents IS DISTINCT FROM NEW.customer_total_ht_cents + v_service_vat + v_shipping_vat THEN
    RAISE EXCEPTION 'oppe_tax_amounts_inconsistent' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER c_marketplace_guard_oppe_tax_validation
  BEFORE INSERT OR UPDATE ON public.marketplace_commercial_proposals
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_guard_oppe_tax_validation();
REVOKE ALL ON FUNCTION public.marketplace_guard_oppe_tax_validation() FROM PUBLIC, anon, authenticated;

-- Facture : TVA par ligne au taux validé de chaque ligne, regroupée par taux.
CREATE OR REPLACE FUNCTION public.marketplace_issue_oppe_invoice(
  p_proposal_id uuid, p_seller jsonb, p_customer jsonb, p_payment jsonb, p_service_label text
) RETURNS uuid
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v public.marketplace_commercial_proposals%ROWTYPE; v_id uuid; v_number text;
  v_rate integer; v_ship_rate integer; v_service_vat integer; v_shipping_vat integer; v_total_vat integer; v_breakdown jsonb;
BEGIN
  SELECT id INTO v_id FROM public.marketplace_oppe_invoices WHERE proposal_id = p_proposal_id;
  IF FOUND THEN RETURN v_id; END IF;
  SELECT * INTO v FROM public.marketplace_commercial_proposals WHERE id = p_proposal_id;
  IF NOT FOUND OR v.accepted_at IS NULL THEN RAISE EXCEPTION 'invoice_requires_accepted_proposal'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.marketplace_oppe_orders WHERE proposal_id = p_proposal_id) THEN
    RAISE EXCEPTION 'invoice_requires_paid_order';
  END IF;
  IF v.tax_validated_at IS NULL OR v.customer_total_ttc_cents IS NULL THEN RAISE EXCEPTION 'invoice_requires_validated_tax'; END IF;
  PERFORM 1 FROM public.marketplace_cases WHERE id = v.case_id FOR UPDATE;
  SELECT id INTO v_id FROM public.marketplace_oppe_invoices WHERE proposal_id = p_proposal_id;
  IF FOUND THEN RETURN v_id; END IF;

  v_rate := v.customer_vat_rate_bps;
  v_total_vat := coalesce(v.customer_vat_amount_cents, 0);
  IF v.shipping_vat_rate_bps IS NOT NULL THEN
    v_ship_rate := v.shipping_vat_rate_bps;
    v_service_vat := round(v.customer_service_price_cents::numeric * coalesce(v_rate, 0) / 10000)::integer;
    v_shipping_vat := round(v.shipping_total_cents::numeric * v_ship_rate / 10000)::integer;
  ELSE
    -- Historique : un seul taux ; l'écart d'arrondi est porté par la ligne de prestation.
    v_ship_rate := v_rate;
    v_shipping_vat := CASE WHEN v.shipping_total_cents = 0 OR v_rate IS NULL THEN 0 ELSE round(v.shipping_total_cents::numeric * v_rate / 10000)::integer END;
    v_service_vat := v_total_vat - v_shipping_vat;
  END IF;
  IF v_service_vat + v_shipping_vat <> v_total_vat THEN RAISE EXCEPTION 'invoice_vat_mismatch'; END IF;

  v_breakdown := (
    SELECT jsonb_agg(jsonb_build_object('rate_bps', r, 'base_ht_cents', b, 'vat_cents', t) ORDER BY r)
    FROM (SELECT r, sum(b) AS b, sum(t) AS t FROM (
      VALUES (v_rate, v.customer_service_price_cents, v_service_vat),
             (v_ship_rate, v.shipping_total_cents, v_shipping_vat)) AS x(r, b, t)
      WHERE b > 0 GROUP BY r) g);
  v_number := public.marketplace_next_oppe_number(CASE WHEN v.brand = 'FINE_BINDERY' THEN 'FB' ELSE 'MR' END);
  INSERT INTO public.marketplace_oppe_invoices(proposal_id, case_id, brand, number, issue_date, seller, customer, currency,
    total_ht_cents, total_vat_cents, total_ttc_cents, vat_breakdown, legal_mentions, payment, retained_until)
  VALUES (v.id, v.case_id, v.brand, v_number, (now() AT TIME ZONE 'Europe/Paris')::date, p_seller, p_customer, v.currency,
    v.customer_total_ht_cents, v_total_vat, v.customer_total_ttc_cents, v_breakdown,
    coalesce(p_seller->'legal_mentions', '[]'::jsonb), p_payment, ((now() AT TIME ZONE 'Europe/Paris')::date + interval '10 years')::date)
  RETURNING id INTO v_id;
  INSERT INTO public.marketplace_oppe_invoice_items(invoice_id, position, label, category, quantity, unit_ht_cents, vat_rate_bps, total_ht_cents, vat_cents, total_ttc_cents)
  VALUES (v_id, 1, btrim(p_service_label), 'service', 1, v.customer_service_price_cents, v_rate, v.customer_service_price_cents,
          v_service_vat, v.customer_service_price_cents + v_service_vat);
  IF v.shipping_total_cents > 0 THEN
    INSERT INTO public.marketplace_oppe_invoice_items(invoice_id, position, label, category, quantity, unit_ht_cents, vat_rate_bps, total_ht_cents, vat_cents, total_ttc_cents)
    VALUES (v_id, 2, CASE WHEN v.shipping_offer_kind = 'book_round_trip_fr' THEN 'Transport aller-retour (forfait)' ELSE 'Transport' END,
            'shipping', 1, v.shipping_total_cents, v_ship_rate, v.shipping_total_cents, v_shipping_vat, v.shipping_total_cents + v_shipping_vat);
  END IF;
  IF (SELECT sum(total_ttc_cents) FROM public.marketplace_oppe_invoice_items WHERE invoice_id = v_id) <> v.customer_total_ttc_cents THEN
    RAISE EXCEPTION 'invoice_total_mismatch';
  END IF;
  INSERT INTO public.marketplace_events(case_id, event_type, metadata)
  VALUES (v.case_id, 'oppe_invoice_issued', jsonb_build_object('invoice_id', v_id, 'number', v_number, 'total_ttc_cents', v.customer_total_ttc_cents));
  RETURN v_id;
END $$;

-- Retour arrière (avant tout devis Oppe validé) : DROP du trigger c_marketplace_guard_oppe_tax_validation et de sa fonction ;
-- rétablir marketplace_issue_oppe_invoice depuis 20261005150000 ; rétablir marketplace_round_trip_offer_check depuis
-- 20261001160000 ; DROP des trois colonnes ajoutées.
