-- Analyse documentaire et décision administrative du propriétaire du 7 octobre 2026.
-- OPPE redevable ; B 15 HT + 20 % = 18 TTC ; C 3 % TVA comprise. Aucun historique recalculé.
ALTER TABLE marketplace_workshop_offer_settings ADD COLUMN connect_onboarding_open boolean NOT NULL DEFAULT false;
ALTER TABLE marketplace_workshop_connect_consents ADD COLUMN fee_tax_basis text
  CHECK(fee_tax_basis IS NULL OR fee_tax_basis IN ('vat_inclusive_fr_20','explicit_ht_legacy'));
ALTER TABLE marketplace_workshop_online_payments ADD COLUMN fee_tax_basis text
  CHECK(fee_tax_basis IS NULL OR fee_tax_basis IN ('vat_inclusive_fr_20','explicit_ht_legacy'));
ALTER TABLE marketplace_workshop_online_payments ADD COLUMN fee_brand text CHECK(fee_brand IS NULL OR fee_brand IN ('MA_RELIURE','FINE_BINDERY'));
ALTER TABLE marketplace_workshop_online_payments ADD COLUMN fee_customer_snapshot jsonb;
CREATE TABLE marketplace_workshop_connect_consent_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, binder_id uuid NOT NULL REFERENCES marketplace_binders(id),
  consent jsonb NOT NULL, superseded_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION marketplace_archive_connect_consent() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
  IF OLD.fee_tax_basis='explicit_ht_legacy' AND NEW.fee_tax_basis IS DISTINCT FROM OLD.fee_tax_basis THEN
    RAISE EXCEPTION 'explicit_ht_convention_requires_administrative_transition'; END IF;
  IF NEW IS DISTINCT FROM OLD THEN
    INSERT INTO marketplace_workshop_connect_consent_history(binder_id,consent) VALUES(OLD.binder_id,to_jsonb(OLD)); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER marketplace_archive_connect_consent BEFORE UPDATE ON marketplace_workshop_connect_consents
  FOR EACH ROW EXECUTE FUNCTION marketplace_archive_connect_consent();
CREATE FUNCTION marketplace_snapshot_workshop_fee_basis() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE c marketplace_workshop_connect_consents%ROWTYPE; b marketplace_binder_billing_profiles%ROWTYPE;
BEGIN
  SELECT * INTO STRICT c FROM marketplace_workshop_connect_consents WHERE binder_id=NEW.binder_id;
  SELECT * INTO STRICT b FROM marketplace_binder_billing_profiles WHERE binder_id=NEW.binder_id;
  IF c.terms_version<>'oppe-workshop-2026-10-07-v2' OR c.fee_tax_basis IS DISTINCT FROM 'vat_inclusive_fr_20' THEN
    RAISE EXCEPTION 'current_vat_inclusive_consent_required'; END IF;
  IF b.country IS DISTINCT FROM 'FR' OR b.postal_code !~ '^[0-9]{5}$' OR b.postal_code ~ '^(97|98)' OR b.postal_code IS NULL
    OR nullif(btrim(b.address_line1),'') IS NULL OR nullif(btrim(b.city),'') IS NULL
    OR nullif(btrim(coalesce(b.legal_name,b.workshop_name)),'') IS NULL OR b.vat_regime IS NULL THEN
    RAISE EXCEPTION 'workshop_fiscal_qualification_required'; END IF;
  NEW.fee_tax_basis:=c.fee_tax_basis;
  NEW.fee_customer_snapshot:=jsonb_build_object('type','BUSINESS','name',coalesce(b.legal_name,b.workshop_name),
    'business_name',coalesce(b.legal_name,b.workshop_name),'vat_number',b.vat_number,'siren',b.siren,
    'address_line1',b.address_line1,'address_line2',b.address_line2,'postal_code',b.postal_code,'city',b.city,'country',b.country,'email',b.email);
  RETURN NEW;
END $$;
CREATE TRIGGER marketplace_snapshot_workshop_fee_basis BEFORE INSERT ON marketplace_workshop_online_payments
  FOR EACH ROW EXECUTE FUNCTION marketplace_snapshot_workshop_fee_basis();

CREATE FUNCTION marketplace_preserve_collected_fee_terms() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
  IF OLD.paid_at IS NOT NULL AND (NEW.fee_tax_basis IS DISTINCT FROM OLD.fee_tax_basis OR
    NEW.fee_brand IS DISTINCT FROM OLD.fee_brand OR NEW.fee_customer_snapshot IS DISTINCT FROM OLD.fee_customer_snapshot OR
    NEW.fee_cents IS DISTINCT FROM OLD.fee_cents) THEN RAISE EXCEPTION 'collected_fee_terms_immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER marketplace_preserve_collected_fee_terms BEFORE UPDATE ON marketplace_workshop_online_payments
  FOR EACH ROW EXECUTE FUNCTION marketplace_preserve_collected_fee_terms();
CREATE TABLE marketplace_workshop_fee_counters (
  brand text NOT NULL CHECK(brand IN ('MA_RELIURE','FINE_BINDERY')), year integer NOT NULL,
  kind text NOT NULL CHECK(kind IN ('invoice','credit_note')), last_value integer NOT NULL DEFAULT 0,
  PRIMARY KEY(brand,year,kind)
);
CREATE TABLE marketplace_workshop_fee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), binder_id uuid NOT NULL REFERENCES marketplace_binders(id),
  payment_id uuid NOT NULL REFERENCES marketplace_workshop_online_payments(id),
  invoice_document_id uuid REFERENCES marketplace_workshop_fee_documents(id),
  kind text NOT NULL CHECK(kind IN ('invoice','credit_note')), number text NOT NULL UNIQUE,
  brand text NOT NULL CHECK(brand IN ('MA_RELIURE','FINE_BINDERY')),
  issued_at timestamptz NOT NULL DEFAULT now(), stripe_application_fee_id text,
  refunded_fee_cumulative_cents integer NOT NULL DEFAULT 0 CHECK(refunded_fee_cumulative_cents>=0),
  total_ht_cents integer NOT NULL CHECK(total_ht_cents>=0), total_vat_cents integer NOT NULL CHECK(total_vat_cents>=0),
  total_ttc_cents integer NOT NULL CHECK(total_ttc_cents>=0), document jsonb NOT NULL,
  CHECK(total_ht_cents+total_vat_cents=total_ttc_cents),
  CHECK((kind='invoice' AND invoice_document_id IS NULL) OR (kind='credit_note' AND invoice_document_id IS NOT NULL))
);
CREATE UNIQUE INDEX marketplace_one_workshop_fee_invoice ON marketplace_workshop_fee_documents(payment_id) WHERE kind='invoice';
CREATE UNIQUE INDEX marketplace_one_workshop_fee_credit_per_refund ON marketplace_workshop_fee_documents(payment_id,refunded_fee_cumulative_cents) WHERE kind='credit_note';
CREATE FUNCTION marketplace_fee_document_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
  RAISE EXCEPTION 'issued_fee_document_immutable'; END $$;
CREATE TRIGGER marketplace_fee_document_immutable BEFORE UPDATE OR DELETE ON marketplace_workshop_fee_documents
  FOR EACH ROW EXECUTE FUNCTION marketplace_fee_document_immutable();

CREATE FUNCTION marketplace_issue_workshop_fee_documents(p_payment_id uuid,p_fee_id text,p_fee_amount integer,
  p_fee_refunded integer,p_brand text,p_seller jsonb,p_customer jsonb)
RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE p marketplace_workshop_online_payments%ROWTYPE; i marketplace_workshop_fee_documents%ROWTYPE;
  v_id uuid; v_kind text; v_number text; v_counter integer; v_year integer:=extract(year FROM current_date);
  v_gross integer; v_net integer; v_vat integer; v_previous integer; v_previous_net integer;
  v_refunded integer; v_snapshot jsonb; v_label text;
BEGIN
  SELECT * INTO STRICT p FROM marketplace_workshop_online_payments WHERE id=p_payment_id FOR UPDATE;
  IF p.fee_tax_basis IS DISTINCT FROM 'vat_inclusive_fr_20' OR p.paid_at IS NULL OR p_fee_amount IS DISTINCT FROM p.fee_cents
    OR p.fee_brand IS DISTINCT FROM p_brand OR p_fee_refunded IS NULL OR p_fee_refunded<0 OR p_fee_refunded>p.fee_cents OR p_brand NOT IN ('MA_RELIURE','FINE_BINDERY')
    OR (p.fee_cents>0 AND nullif(p_fee_id,'') IS NULL) THEN RAISE EXCEPTION 'fee_collection_not_verified'; END IF;
  SELECT * INTO i FROM marketplace_workshop_fee_documents WHERE payment_id=p.id AND kind='invoice';
  IF FOUND AND i.stripe_application_fee_id IS DISTINCT FROM p_fee_id THEN RAISE EXCEPTION 'fee_source_changed'; END IF;
  v_refunded:=greatest(coalesce(p.fee_refunded_cents,0),p_fee_refunded);
  IF v_refunded>p.fee_cents THEN RAISE EXCEPTION 'fee_refund_out_of_range'; END IF;
  UPDATE marketplace_workshop_online_payments SET fee_refunded_cents=v_refunded WHERE id=p.id;
  FOR v_kind IN SELECT unnest(ARRAY['invoice','credit_note']) LOOP
    IF v_kind='invoice' THEN
      IF i.id IS NOT NULL THEN CONTINUE; END IF;
      IF nullif(p_seller->>'vat_number','') IS NULL OR nullif(p_customer->>'address_line1','') IS NULL
        OR nullif(p_customer->>'business_name','') IS NULL OR p_customer->>'country'<>'FR' THEN
        RAISE EXCEPTION 'fee_invoice_identity_missing'; END IF;
      v_gross:=p.fee_cents; v_net:=round(v_gross::numeric*10000/12000); v_vat:=v_gross-v_net;
      v_label:='Frais plateforme — 3 % du montant encaissé, TVA comprise, hors frais Stripe';
    ELSE
      SELECT coalesce(sum(total_ttc_cents),0),coalesce(sum(total_ht_cents),0) INTO v_previous,v_previous_net
        FROM marketplace_workshop_fee_documents WHERE payment_id=p.id AND kind='credit_note';
      IF v_refunded<=v_previous THEN CONTINUE; END IF;
      v_gross:=v_refunded-v_previous; v_net:=round(v_refunded::numeric*10000/12000)-v_previous_net; v_vat:=v_gross-v_net;
      v_label:='Avoir sur frais plateforme effectivement remboursés par Stripe';
    END IF;
    INSERT INTO marketplace_workshop_fee_counters(brand,year,kind,last_value) VALUES(p_brand,v_year,v_kind,1)
      ON CONFLICT(brand,year,kind) DO UPDATE SET last_value=marketplace_workshop_fee_counters.last_value+1 RETURNING last_value INTO v_counter;
    v_id:=gen_random_uuid();
    v_number:='OPPE-'||CASE p_brand WHEN 'MA_RELIURE' THEN 'MR' ELSE 'FB' END||'-C-'||
      CASE v_kind WHEN 'invoice' THEN 'F' ELSE 'AV' END||'-'||v_year||'-'||lpad(v_counter::text,6,'0');
    v_snapshot:=jsonb_build_object('id',v_id,'number',v_number,'issue_date',current_date,'brand',p_brand,
      'seller',CASE WHEN v_kind='invoice' THEN p_seller ELSE i.document->'seller' END,
      'customer',CASE WHEN v_kind='invoice' THEN p_customer ELSE i.document->'customer' END,
      'currency','EUR','total_ht_cents',v_net,'total_vat_cents',v_vat,'total_ttc_cents',v_gross,
      'vat_breakdown',jsonb_build_array(jsonb_build_object('rate_bps',2000,'base_ht_cents',v_net,'vat_cents',v_vat)),
      'payment',jsonb_build_object('paid_at',p.paid_at,'method','stripe_application_fee','payment_intent_id',p.payment_intent_id),
      'issued_at',now(),'reason',v_label,'tax_decision','oppe-workshop-tax-2026-10-07',
      'items',jsonb_build_array(jsonb_build_object('position',0,'label',v_label,'category','platform_fee','quantity',1,
        'unit_ht_cents',v_net,'vat_rate_bps',2000,'total_ht_cents',v_net,'vat_cents',v_vat,'total_ttc_cents',v_gross)));
    INSERT INTO marketplace_workshop_fee_documents(id,binder_id,payment_id,invoice_document_id,kind,number,brand,
      stripe_application_fee_id,refunded_fee_cumulative_cents,total_ht_cents,total_vat_cents,total_ttc_cents,document)
      VALUES(v_id,p.binder_id,p.id,CASE WHEN v_kind='credit_note' THEN i.id ELSE NULL END,v_kind,v_number,p_brand,
        p_fee_id,CASE WHEN v_kind='credit_note' THEN v_refunded ELSE 0 END,v_net,v_vat,v_gross,v_snapshot);
    IF v_kind='invoice' THEN SELECT * INTO STRICT i FROM marketplace_workshop_fee_documents WHERE id=v_id; END IF;
  END LOOP;
END $$;
ALTER TABLE marketplace_workshop_connect_consent_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_workshop_fee_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_workshop_fee_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON marketplace_workshop_connect_consent_history,marketplace_workshop_fee_counters,marketplace_workshop_fee_documents FROM anon,authenticated;
GRANT ALL ON marketplace_workshop_connect_consent_history,marketplace_workshop_fee_counters,marketplace_workshop_fee_documents TO service_role;
GRANT USAGE,SELECT ON SEQUENCE marketplace_workshop_connect_consent_history_id_seq TO service_role;
REVOKE ALL ON FUNCTION marketplace_issue_workshop_fee_documents(uuid,text,integer,integer,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_issue_workshop_fee_documents(uuid,text,integer,integer,text,jsonb,jsonb) TO service_role;
-- Rollback : fermer B/C ; conserver le Worker capable de traiter les webhooks et lire ces documents.
