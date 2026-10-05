-- Journal client propre : rattachement explicite à la facture de commande, payeur et coût.
CREATE FUNCTION public.marketplace_validate_workshop_transport() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE w marketplace_binder_works%ROWTYPE; i marketplace_binder_invoices%ROWTYPE;
BEGIN
  IF NEW.kind NOT IN ('outbound','return') THEN RETURN NEW; END IF;
  SELECT * INTO STRICT w FROM marketplace_binder_works WHERE id=NEW.work_id;
  IF w.source NOT IN ('mon_client','workshop_platform') THEN RETURN NEW; END IF;
  SELECT i1.* INTO STRICT i FROM marketplace_binder_invoices i1 JOIN marketplace_binder_quotes q ON q.id=i1.quote_id
    WHERE i1.id=(NEW.details->>'invoiceId')::uuid AND i1.binder_id=w.binder_id AND q.work_id=w.id AND i1.status='issued';
  IF NEW.details->>'payer' IS NULL OR NEW.details->>'payer' NOT IN ('customer','workshop') THEN RAISE EXCEPTION 'transport_payer_required'; END IF;
  IF NEW.details->>'mode'='parcel' AND ((NEW.details->>'transportCostCents')::integer IS NULL OR
    (NEW.details->>'transportCostCents')::integer<0 OR nullif(btrim(NEW.details->>'coverageEvidence'),'') IS NULL) THEN
    RAISE EXCEPTION 'transport_cost_and_coverage_required'; END IF;
  -- Ce journal constate un transport organisé par l'atelier : aucun achat Sendcloud ni forfait Oppe.
  RETURN NEW;
END $$;
CREATE TRIGGER marketplace_validate_workshop_transport BEFORE INSERT ON marketplace_work_logistics_events
FOR EACH ROW EXECUTE FUNCTION marketplace_validate_workshop_transport();
-- Retour arrière : désactiver ce trigger ; ne jamais réécrire le journal existant.
