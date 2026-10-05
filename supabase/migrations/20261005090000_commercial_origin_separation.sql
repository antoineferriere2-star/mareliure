-- Séparation durable des deux origines commerciales (modèle Oppe, 5 octobre 2026).
--
-- A — projet Oppe : une demande générique confiée à Ma Reliure ou Fine Bindery. Oppe vend,
--     choisit l'atelier, facture le client ; l'atelier facture Oppe.
-- B/C — client propre d'atelier : une demande venue du lien personnel ou de la vitrine d'un
--     atelier. L'atelier vend et facture ; Oppe fournit le logiciel et les services.
--
-- Aucune donnée historique n'est réécrite : les gardes s'appliquent aux nouvelles écritures.
-- Les propositions déjà acceptées, devis émis et factures émises restent intacts.

-- 1. L'origine commerciale, dérivée de la provenance réelle du dossier (jamais saisie).
ALTER TABLE public.marketplace_cases
  ADD COLUMN commercial_origin text GENERATED ALWAYS AS (
    CASE WHEN acquisition_origin IN ('BINDER_REFERRED', 'FINEBINDERY_PROFILE')
      THEN 'workshop_client' ELSE 'oppe' END
  ) STORED;

-- 2. La provenance se fige dès qu'un engagement existe : proposition Oppe, offre ou fiche ouvrage.
CREATE FUNCTION public.marketplace_lock_commercial_origin() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.acquisition_origin IS NOT DISTINCT FROM OLD.acquisition_origin
     AND NEW.referred_binder_id IS NOT DISTINCT FROM OLD.referred_binder_id THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.marketplace_commercial_proposals WHERE case_id = OLD.id)
     OR EXISTS (SELECT 1 FROM public.marketplace_binder_works WHERE case_id = OLD.id)
     OR EXISTS (SELECT 1 FROM public.marketplace_case_matches WHERE case_id = OLD.id AND state <> 'invited')
     OR EXISTS (SELECT 1 FROM public.marketplace_quotes WHERE case_id = OLD.id) THEN
    RAISE EXCEPTION 'commercial_origin_locked' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER marketplace_lock_commercial_origin
  BEFORE UPDATE OF acquisition_origin, referred_binder_id ON public.marketplace_cases
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_lock_commercial_origin();

-- 3. Aucune vente Oppe sur le client propre d'un atelier.
CREATE FUNCTION public.marketplace_guard_oppe_sale_origin() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_origin text;
BEGIN
  SELECT commercial_origin INTO v_origin FROM public.marketplace_cases WHERE id = NEW.case_id;
  IF v_origin = 'workshop_client' THEN
    RAISE EXCEPTION 'oppe_sale_forbidden_on_workshop_client' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER a_marketplace_guard_oppe_sale_origin
  BEFORE INSERT ON public.marketplace_commercial_proposals
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_guard_oppe_sale_origin();

-- 4. Trois provenances pour les fiches de l'atelier :
--    mon_client        — saisi par l'atelier, sans dossier ;
--    ma_reliure        — projet Oppe confié à l'atelier (le nom historique est conservé : il
--                        désigne la plateforme, quelle que soit la marque du dossier) ;
--    workshop_platform — client propre de l'atelier arrivé par son lien ou sa vitrine.
ALTER TABLE public.marketplace_binder_clients DROP CONSTRAINT marketplace_binder_clients_origin_check;
ALTER TABLE public.marketplace_binder_clients ADD CONSTRAINT marketplace_binder_clients_origin_check
  CHECK (origin IN ('mon_client', 'ma_reliure', 'workshop_platform')
         AND (origin_case_id IS NULL OR origin <> 'mon_client'));
ALTER TABLE public.marketplace_binder_works DROP CONSTRAINT marketplace_binder_works_source_check;
ALTER TABLE public.marketplace_binder_works ADD CONSTRAINT marketplace_binder_works_source_check
  CHECK (source IN ('mon_client', 'ma_reliure', 'workshop_platform')
         AND (case_id IS NULL OR source <> 'mon_client'));

-- Une provenance ne change jamais après création, par aucune voie.
CREATE FUNCTION public.marketplace_freeze_binder_provenance() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'marketplace_binder_works' THEN
    IF NEW.source IS DISTINCT FROM OLD.source OR NEW.case_id IS DISTINCT FROM OLD.case_id THEN
      RAISE EXCEPTION 'binder_provenance_immutable' USING ERRCODE = 'check_violation';
    END IF;
  ELSIF NEW.origin IS DISTINCT FROM OLD.origin OR NEW.origin_case_id IS DISTINCT FROM OLD.origin_case_id THEN
    RAISE EXCEPTION 'binder_provenance_immutable' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER marketplace_freeze_work_provenance BEFORE UPDATE ON public.marketplace_binder_works
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_freeze_binder_provenance();
CREATE TRIGGER marketplace_freeze_client_provenance BEFORE UPDATE ON public.marketplace_binder_clients
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_freeze_binder_provenance();

-- 5. Aucun devis ni facture de l'atelier au client final d'une commande Oppe.
--    La facture de l'atelier à Oppe passe par un autre circuit (factures fournisseurs).
CREATE FUNCTION public.marketplace_binder_document_is_oppe_order(p_binder uuid, p_work uuid, p_client uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.marketplace_binder_works w
    WHERE p_work IS NOT NULL AND w.id = p_work AND w.binder_id = p_binder AND w.source = 'ma_reliure'
  ) OR EXISTS (
    SELECT 1 FROM public.marketplace_binder_clients c
    WHERE p_client IS NOT NULL AND c.id = p_client AND c.binder_id = p_binder AND c.origin = 'ma_reliure'
  );
$$;
REVOKE ALL ON FUNCTION public.marketplace_binder_document_is_oppe_order(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_binder_document_is_oppe_order(uuid, uuid, uuid) TO service_role;

CREATE FUNCTION public.marketplace_guard_binder_quote_circuit() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.work_id IS NOT DISTINCT FROM OLD.work_id
     AND NEW.client_id IS NOT DISTINCT FROM OLD.client_id THEN
    RETURN NEW;
  END IF;
  IF public.marketplace_binder_document_is_oppe_order(NEW.binder_id, NEW.work_id, NEW.client_id) THEN
    RAISE EXCEPTION 'workshop_document_forbidden_on_oppe_order' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER a_marketplace_guard_binder_quote_circuit
  BEFORE INSERT OR UPDATE ON public.marketplace_binder_quotes
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_guard_binder_quote_circuit();

CREATE FUNCTION public.marketplace_guard_binder_invoice_circuit() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_work uuid; v_client uuid;
BEGIN
  SELECT work_id, client_id INTO v_work, v_client FROM public.marketplace_binder_quotes
    WHERE id = NEW.quote_id AND binder_id = NEW.binder_id;
  IF public.marketplace_binder_document_is_oppe_order(NEW.binder_id, v_work, v_client) THEN
    RAISE EXCEPTION 'workshop_document_forbidden_on_oppe_order' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER a_marketplace_guard_binder_invoice_circuit
  BEFORE INSERT ON public.marketplace_binder_invoices
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_guard_binder_invoice_circuit();

-- 6. L'import d'un dossier conserve son origine. Pour un projet Oppe, l'atelier reçoit le nom
--    du client, jamais ses coordonnées : il ne vend pas à ce client. Pour un client propre,
--    seul l'atelier qui l'a apporté peut l'importer, coordonnées comprises.
CREATE OR REPLACE FUNCTION public.marketplace_binder_import_case(
  p_binder_id UUID,
  p_case_id UUID,
  p_contact_name TEXT,
  p_contact_email TEXT,
  p_contact_phone TEXT,
  p_work_title TEXT,
  p_work_description TEXT
) RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_work_id UUID;
  v_contact_id UUID;
  v_reference TEXT;
  v_origin TEXT;
  v_referred UUID;
  v_source TEXT;
BEGIN
  SELECT c.commercial_origin, c.referred_binder_id INTO v_origin, v_referred
    FROM public.marketplace_cases c
    WHERE c.id = p_case_id AND c.brand IN ('MA_RELIURE', 'FINE_BINDERY')
    FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.marketplace_case_matches m
    JOIN public.marketplace_binders b ON b.id = m.binder_id
    WHERE m.case_id = p_case_id AND m.binder_id = p_binder_id
      AND m.state = 'selected' AND b.status NOT IN ('suspended', 'rejected')
  ) THEN
    RAISE EXCEPTION 'case_not_selected_for_binder' USING ERRCODE = 'check_violation';
  END IF;
  IF v_origin = 'workshop_client' AND v_referred IS DISTINCT FROM p_binder_id THEN
    RAISE EXCEPTION 'case_not_selected_for_binder' USING ERRCODE = 'check_violation';
  END IF;
  v_source := CASE WHEN v_origin = 'workshop_client' THEN 'workshop_platform' ELSE 'ma_reliure' END;

  SELECT id INTO v_work_id FROM public.marketplace_binder_works
    WHERE binder_id = p_binder_id AND case_id = p_case_id;
  IF FOUND THEN RETURN v_work_id; END IF;

  SELECT id INTO v_contact_id FROM public.marketplace_binder_clients
    WHERE binder_id = p_binder_id AND origin_case_id = p_case_id
    ORDER BY created_at ASC LIMIT 1;

  IF length(btrim(coalesce(p_contact_name, ''))) NOT BETWEEN 1 AND 200
     OR length(btrim(coalesce(p_work_title, ''))) NOT BETWEEN 1 AND 300 THEN
    RAISE EXCEPTION 'invalid_case_import' USING ERRCODE = 'check_violation';
  END IF;

  IF v_contact_id IS NULL THEN
    INSERT INTO public.marketplace_binder_clients
      (binder_id, name, email, phone, origin, origin_case_id)
    VALUES (p_binder_id, btrim(p_contact_name),
            CASE WHEN v_source = 'workshop_platform' THEN nullif(btrim(p_contact_email), '') END,
            CASE WHEN v_source = 'workshop_platform' THEN nullif(btrim(p_contact_phone), '') END,
            v_source, p_case_id)
    RETURNING id INTO v_contact_id;
  END IF;

  v_reference := public.marketplace_binder_next_work_reference(
    p_binder_id, EXTRACT(YEAR FROM now())::INTEGER
  );
  INSERT INTO public.marketplace_binder_works
    (binder_id, contact_id, reference, title, description, source, case_id)
  VALUES (p_binder_id, v_contact_id, v_reference, btrim(p_work_title),
          nullif(btrim(p_work_description), ''), v_source, p_case_id)
  RETURNING id INTO v_work_id;

  RETURN v_work_id;
END;
$$;

-- 7. Qualification de circuit : la commission de 25 % (« network_sale ») et la conciergerie
--    séparée contredisent le modèle A et ne s'ouvrent plus. Les lignes existantes restent.
--    Les nouveaux dossiers sont qualifiés par leur origine : projet Oppe → revente Oppe
--    (`legacy_resale`, le modèle A), client propre → `own_client`.
CREATE OR REPLACE FUNCTION public.marketplace_set_case_payment_circuit(p_case_id uuid,p_circuit text,p_event_id uuid,p_actor uuid,p_notes text)
RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_case public.marketplace_cases%ROWTYPE;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_actor AND role='admin') THEN RAISE EXCEPTION 'admin_required'; END IF;
  IF p_circuit IS NULL OR p_circuit NOT IN ('own_client','legacy_resale') OR length(btrim(coalesce(p_notes,'')))<12 THEN
    RAISE EXCEPTION 'circuit_and_evidence_required';
  END IF;
  SELECT * INTO v_case FROM public.marketplace_cases WHERE id=p_case_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'case_not_found'; END IF;
  IF (p_circuit='own_client') <> (v_case.commercial_origin='workshop_client') THEN
    RAISE EXCEPTION 'circuit_origin_mismatch';
  END IF;
  IF p_event_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.marketplace_events WHERE id=p_event_id AND case_id=p_case_id) THEN
    RAISE EXCEPTION 'evidence_case_mismatch';
  END IF;
  UPDATE public.marketplace_case_payment_circuits SET circuit=p_circuit,evidence_event_id=p_event_id,
    reviewed_by=p_actor,reviewed_at=now(),notes=btrim(p_notes),
    provenance=jsonb_build_object('acquisition_origin',v_case.acquisition_origin,'referred_binder_id',v_case.referred_binder_id,
      'commercial_origin',v_case.commercial_origin,'recorded_case_id',p_case_id,'evidence_event_id',p_event_id)
  WHERE case_id=p_case_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'circuit_not_found'; END IF;
  INSERT INTO public.marketplace_events(case_id,actor_user_id,event_type,metadata)
  VALUES(p_case_id,p_actor,'PAYMENT_CIRCUIT_REVIEWED',jsonb_build_object('circuit',p_circuit,'evidence_event_id',p_event_id,'notes',btrim(p_notes)));
END $$;

-- Les nouveaux circuits ne peuvent plus recevoir network_sale/concierge, même par écriture directe.
CREATE FUNCTION public.marketplace_guard_retired_circuits() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.circuit IN ('network_sale', 'concierge')
     AND (TG_OP = 'INSERT' OR NEW.circuit IS DISTINCT FROM OLD.circuit) THEN
    RAISE EXCEPTION 'payment_circuit_retired' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER a_marketplace_guard_retired_circuits
  BEFORE INSERT OR UPDATE ON public.marketplace_case_payment_circuits
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_guard_retired_circuits();

-- La qualification suit l'origine au moment où la proposition est figée.
CREATE OR REPLACE FUNCTION public.marketplace_snapshot_payment_circuit() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v public.marketplace_case_payment_circuits%ROWTYPE; v_origin text;
BEGIN
  IF TG_OP='UPDATE' AND OLD.accepted_at IS NOT NULL THEN
    IF NEW.payment_circuit IS DISTINCT FROM OLD.payment_circuit
      OR NEW.payment_provenance IS DISTINCT FROM OLD.payment_provenance THEN
      RAISE EXCEPTION 'accepted_payment_terms_immutable';
    END IF;
    RETURN NEW;
  END IF;
  PERFORM 1 FROM public.marketplace_cases WHERE id=NEW.case_id FOR UPDATE;
  SELECT commercial_origin INTO v_origin FROM public.marketplace_cases WHERE id=NEW.case_id;
  SELECT * INTO v FROM public.marketplace_case_payment_circuits WHERE case_id=NEW.case_id;
  IF NEW.payment_circuit IS DISTINCT FROM 'legacy_resale' THEN
    RAISE EXCEPTION 'target_payment_contract_required';
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment_classification_missing'; END IF;
  NEW.payment_provenance := v.provenance || jsonb_build_object(
    'qualified_circuit',v.circuit,'contract_model','legacy_resale','commercial_origin',v_origin,
    'seller','oppe');
  RETURN NEW;
END $$;

-- Fonctions de trigger : aucune exécution directe depuis l'API.
REVOKE ALL ON FUNCTION public.marketplace_lock_commercial_origin(), public.marketplace_guard_oppe_sale_origin(),
  public.marketplace_freeze_binder_provenance(), public.marketplace_guard_binder_quote_circuit(),
  public.marketplace_guard_binder_invoice_circuit(), public.marketplace_guard_retired_circuits()
  FROM PUBLIC, anon, authenticated;

-- Retour arrière (aucune donnée n'est réécrite par cette migration) :
--   DROP TRIGGER a_marketplace_guard_retired_circuits, a_marketplace_guard_binder_invoice_circuit,
--     a_marketplace_guard_binder_quote_circuit, marketplace_freeze_client_provenance,
--     marketplace_freeze_work_provenance, a_marketplace_guard_oppe_sale_origin,
--     marketplace_lock_commercial_origin ; DROP des fonctions associées ;
--   rétablir marketplace_binder_import_case, marketplace_set_case_payment_circuit et
--     marketplace_snapshot_payment_circuit depuis 20261002090000 / 20260928090000 ;
--   rétablir les deux contraintes d'origine à deux valeurs (seulement si aucune ligne
--     'workshop_platform' n'existe) ; ALTER TABLE marketplace_cases DROP COLUMN commercial_origin.
