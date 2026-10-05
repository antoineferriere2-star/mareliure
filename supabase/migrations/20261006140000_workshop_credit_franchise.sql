-- Les factures en franchise utilisent le taux effectif 0, indépendamment du catalogue.
-- Une ancienne franchise sans ventilation reprend son assiette HT figée ; aucun taux nouveau.
CREATE FUNCTION public.marketplace_binder_credit_tax_groups(p_binder_id uuid,p_invoice_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=public AS $$
DECLARE v marketplace_binder_invoices%ROWTYPE;
BEGIN
 SELECT * INTO STRICT v FROM marketplace_binder_invoices WHERE id=p_invoice_id AND binder_id=p_binder_id;
 IF jsonb_array_length(v.vat_breakdown)>0 THEN RETURN v.vat_breakdown; END IF;
 IF v.vat_regime='FRANCHISE' AND v.total_vat_cents=0 THEN
   RETURN jsonb_build_array(jsonb_build_object('vatRateBps',0,'baseHtCents',v.total_ht_cents,'vatCents',0));
 END IF;
 -- Sans ventilation historique fiable : lecture conservée, seul l'avoir complet d'origine est possible.
 RETURN '[]'::jsonb;
END $$;
REVOKE ALL ON FUNCTION public.marketplace_binder_credit_tax_groups(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_binder_credit_tax_groups(uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.marketplace_binder_credit_limits(p_binder_id uuid, p_invoice_id uuid)
RETURNS TABLE("position" integer, remaining_ht_cents bigint) LANGUAGE sql STABLE SET search_path=public AS $$
  WITH line AS (
    SELECT i.*, sum(i.total_ht_cents) OVER (PARTITION BY (CASE WHEN v.vat_regime='FRANCHISE' THEN 0 ELSE i.vat_rate_bps END)) AS gross,
      sum(i.total_ht_cents) OVER (PARTITION BY (CASE WHEN v.vat_regime='FRANCHISE' THEN 0 ELSE i.vat_rate_bps END) ORDER BY i.position, i.id) AS cumulative,
      (SELECT (g->>'baseHtCents')::bigint FROM jsonb_array_elements(public.marketplace_binder_credit_tax_groups(v.binder_id,v.id)) g
       WHERE (g->>'vatRateBps')::integer= (CASE WHEN v.vat_regime='FRANCHISE' THEN 0 ELSE i.vat_rate_bps END)) AS net
    FROM marketplace_binder_invoice_items i JOIN marketplace_binder_invoices v ON v.id=i.invoice_id
    WHERE i.invoice_id=p_invoice_id AND i.binder_id=p_binder_id
  ) SELECT l.position, greatest(0, CASE WHEN gross=0 THEN 0 ELSE
    floor(cumulative::numeric*net/gross)::bigint-floor((cumulative-total_ht_cents)::numeric*net/gross)::bigint END
    - coalesce((SELECT sum(c.total_ht_cents) FROM marketplace_binder_credit_note_items c WHERE c.source_invoice_item_id=l.id),0))
  FROM line l ORDER BY l.position
$$;

CREATE OR REPLACE FUNCTION public.marketplace_binder_create_partial_credit_note(
  p_binder_id uuid,p_invoice_id uuid,p_issue_date date,p_reason text,p_request_id uuid,p_lines jsonb
) RETURNS uuid LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v marketplace_binder_invoices%ROWTYPE; existing marketplace_binder_credit_notes%ROWTYPE;
  item marketplace_binder_invoice_items%ROWTYPE; line jsonb; g jsonb; amt integer; available bigint;
  ht integer:=0; vat integer:=0; breakdown jsonb:='[]'; rate integer; base integer; old_ht integer; old_vat integer;
  new_vat integer; seq integer; prefix text; ident uuid:=gen_random_uuid();
BEGIN
  SELECT * INTO STRICT v FROM marketplace_binder_invoices WHERE id=p_invoice_id AND binder_id=p_binder_id FOR UPDATE;
  SELECT * INTO existing FROM marketplace_binder_credit_notes WHERE request_id=p_request_id;
  IF FOUND THEN
    IF existing.binder_id<>p_binder_id OR existing.invoice_id<>p_invoice_id OR existing.reason<>btrim(p_reason) OR existing.request_lines IS DISTINCT FROM p_lines
      THEN RAISE EXCEPTION 'credit_retry_conflict'; END IF;
    RETURN existing.id;
  END IF;
  IF v.status<>'issued' OR nullif(btrim(p_reason),'') IS NULL OR p_request_id IS NULL
    OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines)=0 THEN
    RAISE EXCEPTION 'credit_invalid'; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(p_lines)) <>
    (SELECT count(DISTINCT value->>'position') FROM jsonb_array_elements(p_lines)) THEN RAISE EXCEPTION 'credit_duplicate_line'; END IF;
  -- Réserver le numéro seulement après validation complète ; tout échec annule la transaction.
  FOR line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    SELECT * INTO STRICT item FROM marketplace_binder_invoice_items WHERE invoice_id=p_invoice_id
      AND binder_id=p_binder_id AND position=(line->>'position')::integer;
    amt:=(line->>'htCents')::integer;
    SELECT remaining_ht_cents INTO available FROM marketplace_binder_credit_limits(p_binder_id,p_invoice_id) WHERE position=item.position;
    IF amt IS NULL OR amt<=0 OR amt>available THEN RAISE EXCEPTION 'credit_exceeds_line'; END IF;
    ht:=ht+amt;
  END LOOP;
  FOR g IN SELECT value FROM jsonb_array_elements(public.marketplace_binder_credit_tax_groups(v.binder_id,v.id)) LOOP
    rate:=(g->>'vatRateBps')::integer;
    SELECT coalesce(sum((j->>'htCents')::integer),0) INTO base FROM jsonb_array_elements(p_lines) j
      JOIN marketplace_binder_invoice_items i ON i.invoice_id=p_invoice_id AND i.position=(j->>'position')::integer WHERE (CASE WHEN v.vat_regime='FRANCHISE' THEN 0 ELSE i.vat_rate_bps END)=rate;
    IF base=0 THEN CONTINUE; END IF;
    SELECT coalesce(sum((b->>'baseHtCents')::integer),0),coalesce(sum((b->>'vatCents')::integer),0)
      INTO old_ht,old_vat FROM marketplace_binder_credit_notes c CROSS JOIN LATERAL jsonb_array_elements(c.vat_breakdown) b
      WHERE c.invoice_id=p_invoice_id AND (b->>'vatRateBps')::integer=rate;
    IF old_ht+base>(g->>'baseHtCents')::integer THEN RAISE EXCEPTION 'credit_exceeds_rate'; END IF;
    new_vat:=round((old_ht+base)::numeric*rate/10000)::integer-old_vat;
    IF new_vat<0 OR old_vat+new_vat>(g->>'vatCents')::integer THEN RAISE EXCEPTION 'credit_exceeds_vat'; END IF;
    vat:=vat+new_vat;
    breakdown:=breakdown||jsonb_build_array(jsonb_build_object('vatRateBps',rate,'baseHtCents',base,'vatCents',new_vat));
  END LOOP;
  IF ht+vat+coalesce((SELECT sum(total_ttc_cents) FROM marketplace_binder_credit_notes WHERE invoice_id=p_invoice_id),0)>v.total_ttc_cents THEN RAISE EXCEPTION 'credit_exceeds_invoice'; END IF;
  INSERT INTO marketplace_binder_document_counters AS c(binder_id,kind,year,last_value)
    VALUES(p_binder_id,'credit_note',extract(year FROM p_issue_date)::integer,1)
    ON CONFLICT(binder_id,kind,year) DO UPDATE SET last_value=c.last_value+1 RETURNING c.last_value INTO seq;
  SELECT credit_note_prefix INTO prefix FROM marketplace_binder_billing_profiles WHERE binder_id=p_binder_id;
  INSERT INTO marketplace_binder_credit_notes(id,binder_id,invoice_id,request_id,request_lines,credit_note_number,issue_date,reason,issuer,client,currency,
    total_ht_cents,total_vat_cents,total_ttc_cents,vat_breakdown,legal_mentions,retained_until)
  VALUES(ident,p_binder_id,p_invoice_id,p_request_id,p_lines,coalesce(prefix,'A')||'-'||extract(year FROM p_issue_date)::integer||'-'||lpad(seq::text,4,'0'),
    p_issue_date,btrim(p_reason),v.issuer,jsonb_build_object('type',v.client_type,'name',v.client_name,'legalName',v.client_legal_name,
    'addressLine1',v.client_billing_address_line1,'postalCode',v.client_billing_postal_code,'city',v.client_billing_city,
    'country',v.client_billing_country,'siren',v.client_siren,'vatNumber',v.client_vat_number),v.currency,ht,vat,ht+vat,breakdown,v.legal_mentions,
    (date_trunc('year',p_issue_date)+interval '11 years - 1 day')::date);
  INSERT INTO marketplace_binder_credit_note_items(credit_note_id,binder_id,source_invoice_item_id,position,label,description,unit,quantity,unit_price_cents,vat_rate_bps,total_ht_cents)
    SELECT ident,p_binder_id,i.id,i.position,i.label,p_reason,'rectification',1,(j->>'htCents')::integer,(CASE WHEN v.vat_regime='FRANCHISE' THEN 0 ELSE i.vat_rate_bps END),(j->>'htCents')::integer
    FROM jsonb_array_elements(p_lines) j JOIN marketplace_binder_invoice_items i ON i.invoice_id=p_invoice_id AND i.position=(j->>'position')::integer;
  RETURN ident;
END $$;


-- Compatibilité des factures anciennes sans ventilation : montants déjà émis repris à l’identique.
CREATE FUNCTION public.marketplace_binder_create_legacy_full_credit_note(
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
    (date_trunc('year', p_issue_date) + interval '11 years - 1 day')::date
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

REVOKE ALL ON FUNCTION public.marketplace_binder_create_legacy_full_credit_note(uuid,uuid,date,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_binder_create_legacy_full_credit_note(uuid,uuid,date,text) TO service_role;
CREATE OR REPLACE FUNCTION public.marketplace_binder_create_full_credit_note(p_binder_id uuid,p_invoice_id uuid,p_issue_date date,p_reason text)
RETURNS uuid LANGUAGE plpgsql SET search_path=public AS $$
DECLARE lines jsonb; existing uuid; v marketplace_binder_invoices%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v FROM marketplace_binder_invoices WHERE id=p_invoice_id AND binder_id=p_binder_id FOR UPDATE;
  IF coalesce((SELECT sum(total_ttc_cents) FROM marketplace_binder_credit_notes WHERE invoice_id=p_invoice_id),0)>=v.total_ttc_cents THEN
    SELECT id INTO existing FROM marketplace_binder_credit_notes WHERE invoice_id=p_invoice_id ORDER BY created_at DESC LIMIT 1; RETURN existing;
  END IF;
  IF jsonb_array_length(public.marketplace_binder_credit_tax_groups(p_binder_id,p_invoice_id))=0 THEN
    RETURN public.marketplace_binder_create_legacy_full_credit_note(p_binder_id,p_invoice_id,p_issue_date,p_reason);
  END IF;
  SELECT jsonb_agg(jsonb_build_object('position',position,'htCents',remaining_ht_cents)) INTO lines
    FROM marketplace_binder_credit_limits(p_binder_id,p_invoice_id) WHERE remaining_ht_cents>0;
  RETURN marketplace_binder_create_partial_credit_note(p_binder_id,p_invoice_id,p_issue_date,p_reason,p_invoice_id,lines);
END $$;
