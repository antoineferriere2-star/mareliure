-- Activité A — facturation Oppe (modèle du 5 octobre 2026).
--
-- 1. Coordonnées de facturation saisies par le client à l'acceptation du devis.
-- 2. Facture de vente Oppe par marque : numérotation continue par série (MR / FB) et par année,
--    vendeur et client figés, TVA par ligne, immuable après émission.
-- 3. Avoirs liés à la facture (remboursements partiels ou totaux), ventilés par taux.
-- 4. Remboursements Stripe et litiges, rapprochés ; frais Stripe réels sur le paiement.
--
-- Aucune facture n'est émise rétroactivement : seules les commandes payées après cette migration
-- en reçoivent une, au rapprochement du paiement.

-- ---------------------------------------------------------------------------
-- 1. Coordonnées de facturation
CREATE TABLE public.marketplace_proposal_billing_details (
  proposal_id uuid PRIMARY KEY REFERENCES public.marketplace_commercial_proposals(id) ON DELETE RESTRICT,
  case_id uuid NOT NULL REFERENCES public.marketplace_cases(id) ON DELETE RESTRICT,
  customer_type text NOT NULL CHECK (customer_type IN ('CUSTOMER','BUSINESS')),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  business_name text CHECK (business_name IS NULL OR length(btrim(business_name)) BETWEEN 1 AND 200),
  vat_number text CHECK (vat_number IS NULL OR length(btrim(vat_number)) BETWEEN 4 AND 20),
  address_line1 text NOT NULL CHECK (length(btrim(address_line1)) BETWEEN 1 AND 200),
  address_line2 text CHECK (address_line2 IS NULL OR length(address_line2) <= 200),
  postal_code text NOT NULL CHECK (length(btrim(postal_code)) BETWEEN 1 AND 20),
  city text NOT NULL CHECK (length(btrim(city)) BETWEEN 1 AND 100),
  country text NOT NULL CHECK (country ~ '^[A-Z]{2}$'),
  email text,
  captured_at timestamptz NOT NULL DEFAULT now(),
  CHECK (customer_type <> 'BUSINESS' OR business_name IS NOT NULL)
);
ALTER TABLE public.marketplace_proposal_billing_details ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_proposal_billing_details FROM anon, authenticated;
GRANT ALL ON public.marketplace_proposal_billing_details TO service_role;

-- Acceptation avec coordonnées : même règles que la v1, plus un pays cohérent avec la fiscalité.
CREATE FUNCTION public.marketplace_accept_proposal_as_customer_v2(
  p_proposal_id uuid, p_customer_user_id uuid, p_terms_version text, p_snapshot_sha256 text,
  p_ip_address text, p_user_agent text, p_billing jsonb
) RETURNS text
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_p public.marketplace_commercial_proposals%ROWTYPE; v_country text; v_type text; v_result text;
BEGIN
  SELECT * INTO v_p FROM public.marketplace_commercial_proposals WHERE id = p_proposal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'proposal_not_found'; END IF;
  IF v_p.accepted_at IS NOT NULL THEN
    RETURN public.marketplace_accept_proposal_as_customer(p_proposal_id, p_customer_user_id, p_terms_version, p_snapshot_sha256, p_ip_address, p_user_agent);
  END IF;
  v_country := upper(btrim(coalesce(p_billing->>'country', '')));
  v_type := coalesce(v_p.customer_type, 'CUSTOMER');
  IF coalesce(v_p.tax_country, v_p.billing_country) IS NOT NULL
     AND v_country IS DISTINCT FROM upper(coalesce(v_p.billing_country, v_p.tax_country)) THEN
    RAISE EXCEPTION 'billing_country_mismatch' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO public.marketplace_proposal_billing_details(proposal_id, case_id, customer_type, name, business_name, vat_number,
    address_line1, address_line2, postal_code, city, country, email)
  VALUES (v_p.id, v_p.case_id, v_type, btrim(p_billing->>'name'),
    CASE WHEN v_type = 'BUSINESS' THEN coalesce(nullif(btrim(p_billing->>'business_name'), ''), v_p.business_name) END,
    CASE WHEN v_type = 'BUSINESS' THEN coalesce(nullif(btrim(p_billing->>'vat_number'), ''), v_p.business_vat_number) END,
    btrim(p_billing->>'address_line1'), nullif(btrim(coalesce(p_billing->>'address_line2', '')), ''),
    btrim(p_billing->>'postal_code'), btrim(p_billing->>'city'), v_country, nullif(btrim(coalesce(p_billing->>'email', '')), ''))
  ON CONFLICT (proposal_id) DO NOTHING;
  v_result := public.marketplace_accept_proposal_as_customer(p_proposal_id, p_customer_user_id, p_terms_version, p_snapshot_sha256, p_ip_address, p_user_agent);
  RETURN v_result;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Factures Oppe
CREATE TABLE public.marketplace_oppe_document_counters (
  series text NOT NULL,
  year integer NOT NULL,
  last_value integer NOT NULL DEFAULT 0,
  PRIMARY KEY (series, year)
);
ALTER TABLE public.marketplace_oppe_document_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_oppe_document_counters FROM anon, authenticated;
GRANT ALL ON public.marketplace_oppe_document_counters TO service_role;

CREATE FUNCTION public.marketplace_next_oppe_number(p_series text) RETURNS text
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_year integer := extract(year FROM (now() AT TIME ZONE 'Europe/Paris'))::integer; v_next integer;
BEGIN
  INSERT INTO public.marketplace_oppe_document_counters(series, year, last_value) VALUES (p_series, v_year, 1)
  ON CONFLICT (series, year) DO UPDATE SET last_value = public.marketplace_oppe_document_counters.last_value + 1
  RETURNING last_value INTO v_next;
  RETURN p_series || '-' || v_year || '-' || lpad(v_next::text, 5, '0');
END $$;

CREATE TABLE public.marketplace_oppe_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL UNIQUE REFERENCES public.marketplace_commercial_proposals(id) ON DELETE RESTRICT,
  case_id uuid NOT NULL REFERENCES public.marketplace_cases(id) ON DELETE RESTRICT,
  brand text NOT NULL CHECK (brand IN ('MA_RELIURE','FINE_BINDERY')),
  number text NOT NULL UNIQUE,
  issue_date date NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  seller jsonb NOT NULL,
  customer jsonb NOT NULL,
  currency text NOT NULL,
  total_ht_cents integer NOT NULL,
  total_vat_cents integer NOT NULL,
  total_ttc_cents integer NOT NULL,
  vat_breakdown jsonb NOT NULL,
  legal_mentions jsonb NOT NULL DEFAULT '[]'::jsonb,
  payment jsonb NOT NULL,
  retained_until date NOT NULL,
  CHECK (total_ttc_cents = total_ht_cents + total_vat_cents)
);
CREATE TABLE public.marketplace_oppe_invoice_items (
  invoice_id uuid NOT NULL REFERENCES public.marketplace_oppe_invoices(id) ON DELETE RESTRICT,
  position integer NOT NULL,
  label text NOT NULL,
  category text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_ht_cents integer NOT NULL,
  vat_rate_bps integer,
  total_ht_cents integer NOT NULL,
  vat_cents integer NOT NULL,
  total_ttc_cents integer NOT NULL,
  PRIMARY KEY (invoice_id, position),
  CHECK (total_ttc_cents = total_ht_cents + vat_cents)
);
CREATE TABLE public.marketplace_oppe_credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.marketplace_oppe_invoices(id) ON DELETE RESTRICT,
  number text NOT NULL UNIQUE,
  issue_date date NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 5),
  items jsonb NOT NULL,
  total_ht_cents integer NOT NULL,
  total_vat_cents integer NOT NULL,
  total_ttc_cents integer NOT NULL CHECK (total_ttc_cents > 0),
  vat_breakdown jsonb NOT NULL,
  retained_until date NOT NULL,
  CHECK (total_ttc_cents = total_ht_cents + total_vat_cents)
);
CREATE TABLE public.marketplace_oppe_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.marketplace_cases(id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL REFERENCES public.marketplace_oppe_invoices(id) ON DELETE RESTRICT,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 5),
  stripe_refund_id text UNIQUE,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','pending','succeeded','failed','canceled')),
  credit_note_id uuid REFERENCES public.marketplace_oppe_credit_notes(id) ON DELETE RESTRICT,
  requested_by uuid,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.marketplace_oppe_disputes (
  stripe_dispute_id text PRIMARY KEY,
  case_id uuid REFERENCES public.marketplace_cases(id) ON DELETE RESTRICT,
  payment_intent_id text,
  amount_cents integer,
  currency text,
  reason text,
  status text NOT NULL,
  evidence_due_by timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marketplace_commercial_proposal_payments
  ADD COLUMN stripe_fee_cents integer CHECK (stripe_fee_cents IS NULL OR stripe_fee_cents >= 0),
  ADD COLUMN stripe_net_cents integer,
  ADD COLUMN stripe_balance_transaction_id text;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['marketplace_oppe_invoices','marketplace_oppe_invoice_items','marketplace_oppe_credit_notes','marketplace_oppe_refunds','marketplace_oppe_disputes'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- Documents émis : jamais modifiés ni supprimés (dix ans de conservation).
CREATE FUNCTION public.marketplace_forbid_oppe_document_change() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'oppe_document_immutable'; END $$;
CREATE TRIGGER marketplace_oppe_invoices_immutable BEFORE UPDATE OR DELETE ON public.marketplace_oppe_invoices
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_forbid_oppe_document_change();
CREATE TRIGGER marketplace_oppe_invoice_items_immutable BEFORE UPDATE OR DELETE ON public.marketplace_oppe_invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_forbid_oppe_document_change();
CREATE TRIGGER marketplace_oppe_credit_notes_immutable BEFORE UPDATE OR DELETE ON public.marketplace_oppe_credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_forbid_oppe_document_change();

-- Émission : une seule facture par commande payée, lignes reprises du devis accepté.
CREATE FUNCTION public.marketplace_issue_oppe_invoice(
  p_proposal_id uuid, p_seller jsonb, p_customer jsonb, p_payment jsonb, p_service_label text
) RETURNS uuid
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v public.marketplace_commercial_proposals%ROWTYPE; v_id uuid; v_number text;
  v_rate integer; v_service_vat integer; v_shipping_vat integer; v_total_vat integer;
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
  -- TVA par ligne, au taux validé du devis ; l'éventuel écart d'arrondi est porté par la dernière
  -- ligne pour que la facture totalise exactement ce que le client a accepté et payé.
  v_service_vat := CASE WHEN v_rate IS NULL THEN 0 ELSE round(v.customer_service_price_cents::numeric * v_rate / 10000)::integer END;
  v_shipping_vat := v_total_vat - v_service_vat;
  IF v.shipping_total_cents = 0 THEN v_service_vat := v_total_vat; v_shipping_vat := 0; END IF;

  v_number := public.marketplace_next_oppe_number(CASE WHEN v.brand = 'FINE_BINDERY' THEN 'FB' ELSE 'MR' END);
  INSERT INTO public.marketplace_oppe_invoices(proposal_id, case_id, brand, number, issue_date, seller, customer, currency,
    total_ht_cents, total_vat_cents, total_ttc_cents, vat_breakdown, legal_mentions, payment, retained_until)
  VALUES (v.id, v.case_id, v.brand, v_number, (now() AT TIME ZONE 'Europe/Paris')::date, p_seller, p_customer, v.currency,
    v.customer_total_ht_cents, v_total_vat, v.customer_total_ttc_cents,
    jsonb_build_array(jsonb_build_object('rate_bps', v_rate, 'base_ht_cents', v.customer_total_ht_cents, 'vat_cents', v_total_vat)),
    coalesce(p_seller->'legal_mentions', '[]'::jsonb), p_payment, ((now() AT TIME ZONE 'Europe/Paris')::date + interval '10 years')::date)
  RETURNING id INTO v_id;
  INSERT INTO public.marketplace_oppe_invoice_items(invoice_id, position, label, category, quantity, unit_ht_cents, vat_rate_bps, total_ht_cents, vat_cents, total_ttc_cents)
  VALUES (v_id, 1, btrim(p_service_label), 'service', 1, v.customer_service_price_cents, v_rate, v.customer_service_price_cents,
          v_service_vat, v.customer_service_price_cents + v_service_vat);
  IF v.shipping_total_cents > 0 THEN
    INSERT INTO public.marketplace_oppe_invoice_items(invoice_id, position, label, category, quantity, unit_ht_cents, vat_rate_bps, total_ht_cents, vat_cents, total_ttc_cents)
    VALUES (v_id, 2, CASE WHEN v.shipping_offer_kind = 'book_round_trip_fr' THEN 'Transport aller-retour (forfait)' ELSE 'Transport' END,
            'shipping', 1, v.shipping_total_cents, v_rate, v.shipping_total_cents, v_shipping_vat, v.shipping_total_cents + v_shipping_vat);
  END IF;
  IF (SELECT sum(total_ttc_cents) FROM public.marketplace_oppe_invoice_items WHERE invoice_id = v_id) <> v.customer_total_ttc_cents THEN
    RAISE EXCEPTION 'invoice_total_mismatch';
  END IF;
  INSERT INTO public.marketplace_events(case_id, event_type, metadata)
  VALUES (v.case_id, 'oppe_invoice_issued', jsonb_build_object('invoice_id', v_id, 'number', v_number, 'total_ttc_cents', v.customer_total_ttc_cents));
  RETURN v_id;
END $$;

-- Avoir : réparti sur les lignes au prorata de leur TTC, HT et TVA recalculés par taux ;
-- jamais au-delà de ce qui reste de la facture.
CREATE FUNCTION public.marketplace_issue_oppe_credit_note(p_invoice_id uuid, p_amount_ttc_cents integer, p_reason text)
RETURNS uuid
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  inv public.marketplace_oppe_invoices%ROWTYPE; v_already integer; v_items jsonb := '[]'::jsonb; v_id uuid; v_number text;
  r record; v_left integer; v_part integer; v_ht integer; v_vat integer; v_count integer; v_i integer := 0;
  v_tot_ht integer := 0; v_tot_vat integer := 0;
BEGIN
  SELECT * INTO inv FROM public.marketplace_oppe_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice_not_found'; END IF;
  IF p_amount_ttc_cents IS NULL OR p_amount_ttc_cents <= 0 THEN RAISE EXCEPTION 'credit_amount_invalid'; END IF;
  SELECT coalesce(sum(total_ttc_cents), 0) INTO v_already FROM public.marketplace_oppe_credit_notes WHERE invoice_id = p_invoice_id;
  IF v_already + p_amount_ttc_cents > inv.total_ttc_cents THEN RAISE EXCEPTION 'credit_exceeds_invoice'; END IF;
  SELECT count(*) INTO v_count FROM public.marketplace_oppe_invoice_items WHERE invoice_id = p_invoice_id;
  v_left := p_amount_ttc_cents;
  FOR r IN SELECT * FROM public.marketplace_oppe_invoice_items WHERE invoice_id = p_invoice_id ORDER BY position LOOP
    v_i := v_i + 1;
    v_part := CASE WHEN v_i = v_count THEN v_left
                   ELSE round(p_amount_ttc_cents::numeric * r.total_ttc_cents / inv.total_ttc_cents)::integer END;
    v_left := v_left - v_part;
    v_ht := CASE WHEN r.vat_rate_bps IS NULL OR r.vat_rate_bps = 0 THEN v_part
                 ELSE round(v_part::numeric * 10000 / (10000 + r.vat_rate_bps))::integer END;
    v_vat := v_part - v_ht;
    v_tot_ht := v_tot_ht + v_ht; v_tot_vat := v_tot_vat + v_vat;
    v_items := v_items || jsonb_build_object('position', r.position, 'label', r.label, 'category', r.category,
      'vat_rate_bps', r.vat_rate_bps, 'total_ht_cents', -v_ht, 'vat_cents', -v_vat, 'total_ttc_cents', -v_part);
  END LOOP;
  v_number := public.marketplace_next_oppe_number(CASE WHEN inv.brand = 'FINE_BINDERY' THEN 'FB-AV' ELSE 'MR-AV' END);
  INSERT INTO public.marketplace_oppe_credit_notes(invoice_id, number, issue_date, reason, items, total_ht_cents, total_vat_cents,
    total_ttc_cents, vat_breakdown, retained_until)
  VALUES (p_invoice_id, v_number, (now() AT TIME ZONE 'Europe/Paris')::date, btrim(p_reason), v_items, v_tot_ht, v_tot_vat,
    p_amount_ttc_cents,
    (SELECT jsonb_agg(jsonb_build_object('rate_bps', k, 'base_ht_cents', -b, 'vat_cents', -t)) FROM (
       SELECT (i->>'vat_rate_bps')::integer AS k, sum(-(i->>'total_ht_cents')::integer) AS b, sum(-(i->>'vat_cents')::integer) AS t
       FROM jsonb_array_elements(v_items) i GROUP BY 1) g),
    ((now() AT TIME ZONE 'Europe/Paris')::date + interval '10 years')::date)
  RETURNING id INTO v_id;
  INSERT INTO public.marketplace_events(case_id, event_type, metadata)
  VALUES (inv.case_id, 'oppe_credit_note_issued', jsonb_build_object('credit_note_id', v_id, 'number', v_number, 'invoice_id', p_invoice_id, 'total_ttc_cents', p_amount_ttc_cents));
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.marketplace_accept_proposal_as_customer_v2(uuid, uuid, text, text, text, text, jsonb),
  public.marketplace_next_oppe_number(text),
  public.marketplace_issue_oppe_invoice(uuid, jsonb, jsonb, jsonb, text),
  public.marketplace_issue_oppe_credit_note(uuid, integer, text),
  public.marketplace_forbid_oppe_document_change()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_accept_proposal_as_customer_v2(uuid, uuid, text, text, text, text, jsonb),
  public.marketplace_issue_oppe_invoice(uuid, jsonb, jsonb, jsonb, text),
  public.marketplace_issue_oppe_credit_note(uuid, integer, text)
  TO service_role;

-- Retour arrière (avant toute facture réelle) : DROP des fonctions, triggers et tables ci-dessus,
-- et des trois colonnes de frais Stripe. Une facture émise ne se supprime jamais.
