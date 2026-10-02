-- Parcours aller-retour d'un livre, du choix avant l'accord jusqu'au retour.
-- Additif, après 20261001160000 : plan logistique du dossier (mode, adresses privées, colis,
-- nature et valeur déclarée), accord de réception de l'atelier, offre « Transport aller-retour »
-- liée à la version du plan, étiquettes achetées à la main par l'opérateur, retour déclaré prêt
-- par l'atelier, verrou d'automatisation en base. Aucun achat, aucune assurance promise.

-- ---------------------------------------------------------------------------
-- Plan logistique : une ligne par dossier, privée (serveur uniquement).
-- ---------------------------------------------------------------------------
CREATE TABLE public.marketplace_case_logistics_plans (
  case_id uuid PRIMARY KEY REFERENCES public.marketplace_cases(id) ON DELETE RESTRICT,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  mode text NOT NULL CHECK (mode IN ('organized_round_trip','customer_arranged','hand_delivery')),
  contact_name text CHECK (contact_name IS NULL OR length(btrim(contact_name)) BETWEEN 2 AND 120),
  phone text CHECK (phone IS NULL OR phone ~ '^\+?[0-9 .()-]{6,24}$'),
  address_line1 text CHECK (address_line1 IS NULL OR length(btrim(address_line1)) BETWEEN 3 AND 160),
  address_line2 text CHECK (address_line2 IS NULL OR length(address_line2) <= 160),
  postal_code text CHECK (postal_code IS NULL OR length(btrim(postal_code)) BETWEEN 2 AND 12),
  city text CHECK (city IS NULL OR length(btrim(city)) BETWEEN 1 AND 100),
  country_code text CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
  return_same_address boolean NOT NULL DEFAULT true,
  return_contact_name text CHECK (return_contact_name IS NULL OR length(btrim(return_contact_name)) BETWEEN 2 AND 120),
  return_address_line1 text CHECK (return_address_line1 IS NULL OR length(btrim(return_address_line1)) BETWEEN 3 AND 160),
  return_address_line2 text CHECK (return_address_line2 IS NULL OR length(return_address_line2) <= 160),
  return_postal_code text CHECK (return_postal_code IS NULL OR length(btrim(return_postal_code)) BETWEEN 2 AND 12),
  return_city text CHECK (return_city IS NULL OR length(btrim(return_city)) BETWEEN 1 AND 100),
  return_country_code text CHECK (return_country_code IS NULL OR return_country_code ~ '^[A-Z]{2}$'),
  -- Colis emballé, mesuré par le client avant l'accord.
  parcel_weight_grams integer CHECK (parcel_weight_grams BETWEEN 1 AND 30000),
  parcel_length_mm integer CHECK (parcel_length_mm BETWEEN 1 AND 2000),
  parcel_width_mm integer CHECK (parcel_width_mm BETWEEN 1 AND 2000),
  parcel_height_mm integer CHECK (parcel_height_mm BETWEEN 1 AND 2000),
  book_description text NOT NULL CHECK (length(btrim(book_description)) BETWEEN 3 AND 600),
  book_kind text NOT NULL CHECK (book_kind IN ('ordinary','old_or_rare','unique_or_heritage')),
  declared_value_cents integer NOT NULL CHECK (declared_value_cents BETWEEN 0 AND 100000000),
  conditions_accepted_at timestamptz NOT NULL,
  submitted_by uuid NOT NULL REFERENCES auth.users(id),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  -- Accord de réception de l'atelier, valable pour UNE version du plan.
  workshop_binder_id uuid REFERENCES public.marketplace_binders(id) ON DELETE RESTRICT,
  workshop_decision text CHECK (workshop_decision IN ('accepted','declined')),
  workshop_plan_version integer,
  workshop_decided_by uuid REFERENCES auth.users(id),
  workshop_decided_at timestamptz,
  workshop_reception_name text CHECK (workshop_reception_name IS NULL OR length(btrim(workshop_reception_name)) BETWEEN 2 AND 120),
  workshop_address_line1 text CHECK (workshop_address_line1 IS NULL OR length(btrim(workshop_address_line1)) BETWEEN 3 AND 160),
  workshop_address_line2 text CHECK (workshop_address_line2 IS NULL OR length(workshop_address_line2) <= 160),
  workshop_postal_code text CHECK (workshop_postal_code IS NULL OR length(btrim(workshop_postal_code)) BETWEEN 2 AND 12),
  workshop_city text CHECK (workshop_city IS NULL OR length(btrim(workshop_city)) BETWEEN 1 AND 100),
  workshop_country_code text CHECK (workshop_country_code IS NULL OR workshop_country_code ~ '^[A-Z]{2}$'),
  workshop_phone text CHECK (workshop_phone IS NULL OR workshop_phone ~ '^\+?[0-9 .()-]{6,24}$'),
  -- Retour : adresse reconfirmée par le client, colis retour mesuré par l'atelier.
  return_address_confirmed_at timestamptz,
  return_address_confirmed_version integer,
  return_ready_at timestamptz,
  return_ready_by uuid REFERENCES auth.users(id),
  return_weight_grams integer CHECK (return_weight_grams BETWEEN 1 AND 30000),
  return_length_mm integer CHECK (return_length_mm BETWEEN 1 AND 2000),
  return_width_mm integer CHECK (return_width_mm BETWEEN 1 AND 2000),
  return_height_mm integer CHECK (return_height_mm BETWEEN 1 AND 2000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT logistics_plan_shipping_fields CHECK (mode <> 'organized_round_trip' OR (
    contact_name IS NOT NULL AND phone IS NOT NULL AND address_line1 IS NOT NULL AND postal_code IS NOT NULL
    AND city IS NOT NULL AND country_code IS NOT NULL AND parcel_weight_grams IS NOT NULL
    AND parcel_length_mm IS NOT NULL AND parcel_width_mm IS NOT NULL AND parcel_height_mm IS NOT NULL
    AND (return_same_address OR (return_contact_name IS NOT NULL AND return_address_line1 IS NOT NULL
      AND return_postal_code IS NOT NULL AND return_city IS NOT NULL AND return_country_code IS NOT NULL)))),
  CONSTRAINT logistics_plan_workshop_decision CHECK ((workshop_decision IS NULL) = (workshop_decided_at IS NULL)
    AND (workshop_decision IS NULL) = (workshop_binder_id IS NULL)
    AND (workshop_decision IS NULL) = (workshop_plan_version IS NULL)
    AND (workshop_decision IS DISTINCT FROM 'accepted' OR (workshop_reception_name IS NOT NULL
      AND workshop_address_line1 IS NOT NULL AND workshop_postal_code IS NOT NULL
      AND workshop_city IS NOT NULL AND workshop_country_code IS NOT NULL))),
  CONSTRAINT logistics_plan_return_ready CHECK ((return_ready_at IS NULL) = (return_ready_by IS NULL)
    AND (return_ready_at IS NULL OR (return_weight_grams IS NOT NULL AND return_length_mm IS NOT NULL
      AND return_width_mm IS NOT NULL AND return_height_mm IS NOT NULL)))
);
ALTER TABLE public.marketplace_case_logistics_plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_case_logistics_plans FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.marketplace_case_logistics_plans TO service_role;

-- France métropolitaine, hors Corse, Monaco et outre-mer (devis distinct nécessaire).
CREATE FUNCTION public.marketplace_fr_mainland_postal(p_country text, p_code text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT coalesce(p_country = 'FR' AND p_code ~ '^[0-9]{5}$'
    AND substr(p_code,1,2)::integer BETWEEN 1 AND 95 AND substr(p_code,1,2) <> '20', false)
$$;

-- Plafond de PRÉSÉLECTION métier (jamais une promesse du transporteur) : colis ≤ 500 g et
-- 350 × 250 × 80 mm, dimensions comparées triées. Retour NULL = éligible ; sinon la raison.
CREATE FUNCTION public.marketplace_round_trip_parcel_ok(p_weight integer, p_a integer, p_b integer, p_c integer)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT coalesce(p_weight BETWEEN 1 AND 500 AND greatest(p_a,p_b,p_c) <= 350
    AND (p_a + p_b + p_c - greatest(p_a,p_b,p_c) - least(p_a,p_b,p_c)) <= 250
    AND least(p_a,p_b,p_c) BETWEEN 1 AND 80, false)
$$;

CREATE FUNCTION public.marketplace_round_trip_plan_block(
  p_plan public.marketplace_case_logistics_plans, p_brand text, p_selected_binder uuid
) RETURNS text LANGUAGE plpgsql STABLE SET search_path=public AS $$
BEGIN
  -- Seuls les dossiers Ma Reliure deviennent un ouvrage avec journal atelier (import 20260922140000).
  IF p_brand IS DISTINCT FROM 'MA_RELIURE' THEN RETURN 'brand_unsupported'; END IF;
  IF p_plan.mode <> 'organized_round_trip' THEN RETURN 'mode_not_organized'; END IF;
  IF p_plan.book_kind <> 'ordinary' OR p_plan.declared_value_cents >= 10000 THEN RETURN 'valuable_book'; END IF;
  -- Causes propres à l'envoi d'abord : le client doit les lire avant toute attente de l'atelier.
  IF NOT marketplace_fr_mainland_postal(p_plan.country_code, p_plan.postal_code)
    OR (NOT p_plan.return_same_address AND NOT marketplace_fr_mainland_postal(p_plan.return_country_code, p_plan.return_postal_code)) THEN
    RETURN 'outside_mainland';
  END IF;
  IF NOT marketplace_round_trip_parcel_ok(p_plan.parcel_weight_grams, p_plan.parcel_length_mm,
    p_plan.parcel_width_mm, p_plan.parcel_height_mm) THEN RETURN 'parcel_review'; END IF;
  IF p_plan.workshop_decision IS DISTINCT FROM 'accepted' OR p_plan.workshop_plan_version IS DISTINCT FROM p_plan.version
    OR p_selected_binder IS NULL OR p_plan.workshop_binder_id IS DISTINCT FROM p_selected_binder THEN
    RETURN 'workshop_acceptance_required';
  END IF;
  IF NOT marketplace_fr_mainland_postal(p_plan.workshop_country_code, p_plan.workshop_postal_code) THEN RETURN 'outside_mainland'; END IF;
  RETURN NULL;
END $$;

-- Le plan se modifie librement jusqu'à ce qu'une offre aller-retour soit présentée ou qu'une
-- proposition soit acceptée. Toute modification du contenu crée une version et annule l'accord
-- de réception de l'atelier. L'historique ne se supprime pas.
CREATE FUNCTION public.marketplace_logistics_plan_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_locked boolean; v_accepted boolean; v_old jsonb; v_new jsonb;
  v_meta text[] := ARRAY['version','submitted_by','submitted_at','conditions_accepted_at','updated_at',
    'workshop_binder_id','workshop_decision','workshop_plan_version','workshop_decided_by','workshop_decided_at',
    'workshop_reception_name','workshop_address_line1','workshop_address_line2','workshop_postal_code',
    'workshop_city','workshop_country_code','workshop_phone','return_address_confirmed_at',
    'return_address_confirmed_version','return_ready_at','return_ready_by','return_weight_grams',
    'return_length_mm','return_width_mm','return_height_mm'];
  v_workshop text[] := ARRAY['workshop_binder_id','workshop_decision','workshop_plan_version','workshop_decided_by',
    'workshop_decided_at','workshop_reception_name','workshop_address_line1','workshop_address_line2',
    'workshop_postal_code','workshop_city','workshop_country_code','workshop_phone'];
  v_return text[] := ARRAY['return_address_confirmed_at','return_address_confirmed_version','return_ready_at',
    'return_ready_by','return_weight_grams','return_length_mm','return_width_mm','return_height_mm'];
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'logistics_plan_history_required'; END IF;
  PERFORM 1 FROM public.marketplace_cases WHERE id = NEW.case_id FOR UPDATE;
  v_accepted := EXISTS (SELECT 1 FROM public.marketplace_commercial_proposals p
    WHERE p.case_id = NEW.case_id AND p.accepted_at IS NOT NULL);
  v_locked := v_accepted OR EXISTS (SELECT 1 FROM public.marketplace_commercial_proposals p
    WHERE p.case_id = NEW.case_id AND p.status = 'proposed' AND p.superseded_at IS NULL
      AND p.shipping_offer_kind = 'book_round_trip_fr');
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN
    IF v_locked THEN RAISE EXCEPTION 'logistics_plan_locked'; END IF;
    IF (to_jsonb(NEW) - v_meta) IS NULL OR EXISTS (
      SELECT 1 FROM jsonb_each(to_jsonb(NEW)) e WHERE e.key = ANY (v_workshop || v_return) AND e.value <> 'null'::jsonb) THEN
      RAISE EXCEPTION 'logistics_plan_fresh_required';
    END IF;
    NEW.version := 1;
    RETURN NEW;
  END IF;
  v_old := to_jsonb(OLD) - v_meta; v_new := to_jsonb(NEW) - v_meta;
  IF NEW.case_id IS DISTINCT FROM OLD.case_id THEN RAISE EXCEPTION 'logistics_plan_case_immutable'; END IF;
  IF v_new IS DISTINCT FROM v_old THEN
    IF v_locked THEN RAISE EXCEPTION 'logistics_plan_locked'; END IF;
    NEW.version := OLD.version + 1;
    NEW.workshop_binder_id := NULL; NEW.workshop_decision := NULL; NEW.workshop_plan_version := NULL;
    NEW.workshop_decided_by := NULL; NEW.workshop_decided_at := NULL;
    RETURN NEW;
  END IF;
  IF NEW.version IS DISTINCT FROM OLD.version THEN RAISE EXCEPTION 'logistics_plan_version_managed'; END IF;
  IF (SELECT jsonb_object_agg(k, to_jsonb(NEW)->k) FROM unnest(v_workshop) k)
    IS DISTINCT FROM (SELECT jsonb_object_agg(k, to_jsonb(OLD)->k) FROM unnest(v_workshop) k) THEN
    IF v_locked THEN RAISE EXCEPTION 'logistics_plan_locked'; END IF;
    IF NEW.workshop_decision IS NOT NULL AND NEW.workshop_plan_version IS DISTINCT FROM NEW.version THEN
      RAISE EXCEPTION 'logistics_plan_version_stale';
    END IF;
  END IF;
  IF (SELECT jsonb_object_agg(k, to_jsonb(NEW)->k) FROM unnest(v_return) k)
    IS DISTINCT FROM (SELECT jsonb_object_agg(k, to_jsonb(OLD)->k) FROM unnest(v_return) k) THEN
    IF NOT v_accepted THEN RAISE EXCEPTION 'return_requires_accepted_proposal'; END IF;
    -- Une étiquette retour active fige l'adresse confirmée et le colis retour mesuré.
    IF EXISTS (SELECT 1 FROM public.marketplace_round_trip_label_jobs j WHERE j.case_id = NEW.case_id
        AND j.direction = 'return' AND j.status IN ('claimed','ambiguous','confirmed')) THEN
      RAISE EXCEPTION 'return_label_in_progress';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER marketplace_logistics_plan_guard BEFORE INSERT OR UPDATE OR DELETE
ON public.marketplace_case_logistics_plans FOR EACH ROW EXECUTE FUNCTION public.marketplace_logistics_plan_guard();

-- ---------------------------------------------------------------------------
-- Offre « Transport aller-retour » : liée à la version du plan présentée, jamais déduite du montant.
-- ---------------------------------------------------------------------------
ALTER TABLE public.marketplace_commercial_proposals ADD COLUMN logistics_plan_version integer;
ALTER TABLE public.marketplace_commercial_proposals ADD CONSTRAINT marketplace_round_trip_plan_version_check
  CHECK ((shipping_offer_kind = 'book_round_trip_fr') = (logistics_plan_version IS NOT NULL)) NOT VALID;
-- Toutes les propositions existantes sont 'manual' (20261001160000) : la contrainte tient déjà.
ALTER TABLE public.marketplace_commercial_proposals VALIDATE CONSTRAINT marketplace_round_trip_plan_version_check;

CREATE FUNCTION public.marketplace_round_trip_offer_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_plan public.marketplace_case_logistics_plans%ROWTYPE; v_brand text; v_binder uuid; v_block text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.shipping_offer_kind IS DISTINCT FROM OLD.shipping_offer_kind
      OR NEW.logistics_plan_version IS DISTINCT FROM OLD.logistics_plan_version THEN
      RAISE EXCEPTION 'round_trip_offer_immutable';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.shipping_offer_kind IS DISTINCT FROM 'book_round_trip_fr' THEN
    NEW.logistics_plan_version := NULL;
    RETURN NEW;
  END IF;
  SELECT brand INTO v_brand FROM public.marketplace_cases WHERE id = NEW.case_id FOR UPDATE;
  SELECT binder_id INTO v_binder FROM public.marketplace_case_matches WHERE case_id = NEW.case_id AND state = 'selected';
  SELECT * INTO v_plan FROM public.marketplace_case_logistics_plans WHERE case_id = NEW.case_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'logistics_plan_required'; END IF;
  v_block := public.marketplace_round_trip_plan_block(v_plan, v_brand, v_binder);
  IF v_block IS NOT NULL THEN RAISE EXCEPTION 'round_trip_not_eligible:%', v_block; END IF;
  NEW.logistics_plan_version := v_plan.version;
  RETURN NEW;
END $$;
CREATE TRIGGER marketplace_round_trip_offer_guard BEFORE INSERT OR UPDATE
ON public.marketplace_commercial_proposals FOR EACH ROW EXECUTE FUNCTION public.marketplace_round_trip_offer_guard();

-- ---------------------------------------------------------------------------
-- Verrou d'automatisation : fermé par défaut, désactivable à tout instant, ouverture tracée.
-- ---------------------------------------------------------------------------
CREATE TABLE public.marketplace_round_trip_automation (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT false,
  provider text NOT NULL DEFAULT 'sendcloud' CHECK (provider IN ('sendcloud')),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(evidence) = 'object' AND length(evidence::text) <= 4000),
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz
);
INSERT INTO public.marketplace_round_trip_automation(id) VALUES (true);
CREATE TABLE public.marketplace_round_trip_automation_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL,
  evidence jsonb NOT NULL,
  actor uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.marketplace_round_trip_automation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_round_trip_automation_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_round_trip_automation, public.marketplace_round_trip_automation_changes FROM anon, authenticated;
GRANT SELECT ON public.marketplace_round_trip_automation, public.marketplace_round_trip_automation_changes TO service_role;

CREATE FUNCTION public.marketplace_set_round_trip_automation(p_actor uuid, p_enabled boolean, p_evidence jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_key text; v_evidence jsonb := coalesce(p_evidence, '{}'::jsonb);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_actor AND role = 'admin') THEN
    RAISE EXCEPTION 'admin_required';
  END IF;
  IF p_enabled IS NULL THEN RAISE EXCEPTION 'decision_required'; END IF;
  IF jsonb_typeof(v_evidence) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'evidence_required'; END IF;
  -- Fermer est toujours possible ; ouvrir exige chacune des preuves de la décision.
  IF p_enabled THEN
    FOREACH v_key IN ARRAY ARRAY['provider_quote','coverage_terms','tax_validation','api_recette','commercial_decision'] LOOP
      IF length(btrim(coalesce(v_evidence->>v_key, ''))) < 8 THEN RAISE EXCEPTION 'evidence_missing:%', v_key; END IF;
    END LOOP;
  END IF;
  UPDATE public.marketplace_round_trip_automation SET enabled = p_enabled, evidence = v_evidence,
    changed_by = p_actor, changed_at = now() WHERE id;
  INSERT INTO public.marketplace_round_trip_automation_changes(enabled, evidence, actor) VALUES (p_enabled, v_evidence, p_actor);
  RETURN jsonb_build_object('enabled', p_enabled);
END $$;
REVOKE ALL ON FUNCTION public.marketplace_set_round_trip_automation(uuid,boolean,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_set_round_trip_automation(uuid,boolean,jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- Étiquettes : achat automatique (tarif revu) OU saisie manuelle par l'opérateur.
-- Une seule réservation ACTIVE par dossier et par sens ; un remplacement après échec ou
-- annulation est une décision explicite de l'opérateur, jamais une reprise automatique.
-- ---------------------------------------------------------------------------
ALTER TABLE public.marketplace_round_trip_label_jobs
  ALTER COLUMN rate_approval_id DROP NOT NULL,
  ADD COLUMN fulfilment text NOT NULL DEFAULT 'automatic' CHECK (fulfilment IN ('automatic','manual')),
  ADD COLUMN method_label text CHECK (method_label IS NULL OR length(btrim(method_label)) BETWEEN 3 AND 160),
  ADD COLUMN reserved_by uuid REFERENCES auth.users(id),
  ADD CONSTRAINT round_trip_fulfilment_evidence CHECK ((fulfilment = 'automatic') = (rate_approval_id IS NOT NULL));
ALTER TABLE public.marketplace_round_trip_label_jobs DROP CONSTRAINT marketplace_round_trip_label_jobs_case_id_direction_key;
CREATE UNIQUE INDEX marketplace_round_trip_label_jobs_active_uidx
  ON public.marketplace_round_trip_label_jobs(case_id, direction) WHERE status IN ('claimed','ambiguous','confirmed');
CREATE INDEX marketplace_round_trip_label_jobs_case_idx ON public.marketplace_round_trip_label_jobs(case_id, direction, created_at);

-- La disponibilité du retour vit désormais sur le plan (aussi pour le traitement manuel).
DROP FUNCTION public.marketplace_mark_round_trip_return_ready(uuid,uuid,uuid);
ALTER TABLE public.marketplace_round_trip_rate_approvals DROP COLUMN return_ready_at, DROP COLUMN return_ready_by;
REVOKE UPDATE ON public.marketplace_round_trip_rate_approvals FROM service_role;

-- Conditions communes à un sens, relues sous verrou : offre acceptée liée au plan, paiement
-- plateforme intégral constaté par Stripe (un règlement déclaré à l'atelier ne compte pas),
-- atelier retenu ayant accepté la réception de cette version, et pour le retour : réception
-- physique, travaux terminés, colis retour mesuré et adresse reconfirmée.
CREATE FUNCTION public.marketplace_round_trip_leg_context(p_case uuid, p_direction text)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_proposal public.marketplace_commercial_proposals%ROWTYPE;
  v_payment public.marketplace_commercial_proposal_payments%ROWTYPE;
  v_plan public.marketplace_case_logistics_plans%ROWTYPE; v_brand text; v_binder uuid; v_work uuid; v_block text;
BEGIN
  IF p_direction NOT IN ('outbound','return') THEN RAISE EXCEPTION 'invalid_direction'; END IF;
  SELECT brand INTO v_brand FROM public.marketplace_cases WHERE id = p_case FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'case_not_found'; END IF;
  SELECT * INTO v_proposal FROM public.marketplace_commercial_proposals
    WHERE case_id = p_case AND accepted_at IS NOT NULL FOR UPDATE;
  IF NOT FOUND OR v_proposal.shipping_offer_kind <> 'book_round_trip_fr' OR v_proposal.payment_circuit <> 'legacy_resale'
    OR v_proposal.status <> 'accepted' OR v_proposal.logistics_plan_version IS NULL THEN
    RAISE EXCEPTION 'round_trip_offer_required';
  END IF;
  SELECT * INTO v_payment FROM public.marketplace_commercial_proposal_payments WHERE proposal_id = v_proposal.id FOR UPDATE;
  IF NOT FOUND OR v_payment.paid_at IS NULL OR v_payment.stripe_checkout_session_id IS NULL
    OR v_payment.stripe_payment_intent_id IS NULL
    OR v_payment.amount_paid_cents IS DISTINCT FROM v_proposal.customer_total_ttc_cents
    OR lower(v_payment.paid_currency) IS DISTINCT FROM 'eur' THEN RAISE EXCEPTION 'platform_payment_required'; END IF;
  SELECT binder_id INTO v_binder FROM public.marketplace_case_matches
    WHERE case_id = p_case AND state = 'selected' AND accepted_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'accepted_workshop_required'; END IF;
  SELECT * INTO v_plan FROM public.marketplace_case_logistics_plans WHERE case_id = p_case FOR UPDATE;
  IF NOT FOUND OR v_plan.version <> v_proposal.logistics_plan_version THEN RAISE EXCEPTION 'logistics_plan_changed_review_required'; END IF;
  v_block := public.marketplace_round_trip_plan_block(v_plan, v_brand, v_binder);
  IF v_block IS NOT NULL THEN RAISE EXCEPTION 'round_trip_not_eligible:%', v_block; END IF;
  IF p_direction = 'return' THEN
    SELECT id INTO v_work FROM public.marketplace_binder_works WHERE case_id = p_case AND binder_id = v_binder FOR UPDATE;
    IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.marketplace_work_logistics_events
      WHERE work_id = v_work AND kind = 'received') THEN RAISE EXCEPTION 'physical_receipt_required'; END IF;
    IF v_plan.return_ready_at IS NULL THEN RAISE EXCEPTION 'return_not_ready'; END IF;
    IF v_plan.return_address_confirmed_version IS DISTINCT FROM v_plan.version THEN
      RAISE EXCEPTION 'return_address_confirmation_required';
    END IF;
  END IF;
  RETURN jsonb_build_object('proposal_id', v_proposal.id, 'binder_id', v_binder,
    'payment_intent', v_payment.stripe_payment_intent_id, 'plan_version', v_plan.version,
    'parcel_ok', CASE WHEN p_direction = 'outbound' THEN true ELSE public.marketplace_round_trip_parcel_ok(
      v_plan.return_weight_grams, v_plan.return_length_mm, v_plan.return_width_mm, v_plan.return_height_mm) END);
END $$;
REVOKE ALL ON FUNCTION public.marketplace_round_trip_leg_context(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_round_trip_leg_context(uuid,text) TO service_role;

-- Achat automatique : verrou ouvert, tarif revu courant, adresses inchangées, colis dans le plafond.
-- Une réservation antérieure échouée ou annulée n'est jamais remplacée automatiquement.
DROP FUNCTION public.marketplace_reserve_round_trip_label(uuid,text,text,text);
CREATE FUNCTION public.marketplace_reserve_round_trip_label(
  p_case uuid, p_direction text, p_outbound_address_sha256 text, p_return_address_sha256 text
) RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_ctx jsonb; v_rate public.marketplace_round_trip_rate_approvals%ROWTYPE;
  v_job public.marketplace_round_trip_label_jobs%ROWTYPE;
BEGIN
  IF NOT (SELECT enabled FROM public.marketplace_round_trip_automation WHERE id) THEN RAISE EXCEPTION 'automation_closed'; END IF;
  v_ctx := public.marketplace_round_trip_leg_context(p_case, p_direction);
  IF NOT (v_ctx->>'parcel_ok')::boolean THEN RAISE EXCEPTION 'return_parcel_review_required'; END IF;
  SELECT * INTO v_rate FROM public.marketplace_round_trip_rate_approvals
    WHERE case_id = p_case AND proposal_id = (v_ctx->>'proposal_id')::uuid AND binder_id = (v_ctx->>'binder_id')::uuid FOR UPDATE;
  IF NOT FOUND OR v_rate.valid_until <= now() THEN RAISE EXCEPTION 'current_rate_approval_required'; END IF;
  IF p_outbound_address_sha256 IS DISTINCT FROM v_rate.outbound_address_sha256
    OR p_return_address_sha256 IS DISTINCT FROM v_rate.return_address_sha256 THEN
    RAISE EXCEPTION 'address_changed_review_required';
  END IF;
  SELECT * INTO v_job FROM public.marketplace_round_trip_label_jobs WHERE case_id = p_case AND direction = p_direction
    ORDER BY (status IN ('claimed','ambiguous','confirmed')) DESC, created_at DESC LIMIT 1;
  IF FOUND THEN
    IF v_job.proposal_id::text <> v_ctx->>'proposal_id' OR v_job.stripe_payment_intent_id <> v_ctx->>'payment_intent' THEN
      RAISE EXCEPTION 'reservation_conflict';
    END IF;
    RETURN jsonb_build_object('outcome', CASE WHEN v_job.status = 'confirmed' THEN 'existing' ELSE 'review_required' END,
      'id', v_job.id, 'status', v_job.status, 'fulfilment', v_job.fulfilment);
  END IF;
  INSERT INTO public.marketplace_round_trip_label_jobs
    (case_id, proposal_id, rate_approval_id, binder_id, direction, stripe_payment_intent_id, fulfilment)
    VALUES (p_case, (v_ctx->>'proposal_id')::uuid, v_rate.id, (v_ctx->>'binder_id')::uuid, p_direction,
      v_ctx->>'payment_intent', 'automatic') RETURNING * INTO v_job;
  RETURN jsonb_build_object('outcome', 'claim', 'id', v_job.id);
END $$;
REVOKE ALL ON FUNCTION public.marketplace_reserve_round_trip_label(uuid,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_reserve_round_trip_label(uuid,text,text,text) TO service_role;

-- Traitement manuel : l'opérateur achète l'étiquette hors plateforme puis la dépose ici.
-- Aucun plafond de coût n'empêche ce chemin : le prix client reste 15 € TTC, un déficit est
-- consigné et doit être reconnu explicitement à la confirmation.
CREATE FUNCTION public.marketplace_reserve_round_trip_label_manual(
  p_case uuid, p_direction text, p_actor uuid, p_replace boolean
) RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_ctx jsonb; v_job public.marketplace_round_trip_label_jobs%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_actor AND role = 'admin') THEN
    RAISE EXCEPTION 'admin_required';
  END IF;
  v_ctx := public.marketplace_round_trip_leg_context(p_case, p_direction);
  SELECT * INTO v_job FROM public.marketplace_round_trip_label_jobs WHERE case_id = p_case AND direction = p_direction
    AND status IN ('claimed','ambiguous','confirmed');
  IF FOUND THEN
    RETURN jsonb_build_object('outcome', CASE WHEN v_job.status = 'confirmed' THEN 'existing'
      WHEN v_job.status = 'claimed' AND v_job.fulfilment = 'manual' THEN 'claim' ELSE 'review_required' END,
      'id', v_job.id, 'status', v_job.status, 'fulfilment', v_job.fulfilment);
  END IF;
  IF EXISTS (SELECT 1 FROM public.marketplace_round_trip_label_jobs WHERE case_id = p_case AND direction = p_direction)
    AND NOT coalesce(p_replace, false) THEN
    RETURN jsonb_build_object('outcome', 'replacement_confirmation_required');
  END IF;
  INSERT INTO public.marketplace_round_trip_label_jobs
    (case_id, proposal_id, rate_approval_id, binder_id, direction, stripe_payment_intent_id, fulfilment, reserved_by)
    VALUES (p_case, (v_ctx->>'proposal_id')::uuid, NULL, (v_ctx->>'binder_id')::uuid, p_direction,
      v_ctx->>'payment_intent', 'manual', p_actor) RETURNING * INTO v_job;
  INSERT INTO public.marketplace_round_trip_label_events(job_id, kind, details)
    VALUES (v_job.id, 'operator_note', jsonb_build_object('note', 'manual_reservation', 'actor', p_actor,
      'replacement', coalesce(p_replace, false), 'return_parcel_ok', (v_ctx->>'parcel_ok')::boolean));
  RETURN jsonb_build_object('outcome', 'claim', 'id', v_job.id);
END $$;
REVOKE ALL ON FUNCTION public.marketplace_reserve_round_trip_label_manual(uuid,text,uuid,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_reserve_round_trip_label_manual(uuid,text,uuid,boolean) TO service_role;

-- Machine d'états : identique à 20261001160000, plus l'objet PDF obligatoire avant confirmation,
-- la méthode de dépôt affichable, le coût réel exigé et le déficit reconnu pour le manuel.
CREATE OR REPLACE FUNCTION public.marketplace_round_trip_label_transition(
  p_job uuid, p_kind text, p_provider_event_id text, p_details jsonb
) RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE j public.marketplace_round_trip_label_jobs%ROWTYPE; v_next text; v_approved integer; v_other integer;
  v_details jsonb := coalesce(p_details,'{}'::jsonb); v_charged integer;
BEGIN
  SELECT * INTO j FROM public.marketplace_round_trip_label_jobs WHERE id=p_job FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'label_job_not_found'; END IF;
  IF p_provider_event_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.marketplace_round_trip_label_events
      WHERE job_id=p_job AND provider_event_id=p_provider_event_id) THEN
    RETURN jsonb_build_object('outcome','duplicate','status',j.status);
  END IF;
  IF v_details ?| ARRAY['address','name','email','phone','photo','proof'] THEN RAISE EXCEPTION 'private_details_refused'; END IF;
  v_next := CASE p_kind
    WHEN 'request_started' THEN CASE WHEN j.status IN ('claimed','ambiguous') AND j.fulfilment='automatic' THEN j.status END
    WHEN 'response_ambiguous' THEN CASE WHEN j.status IN ('claimed','ambiguous') AND j.fulfilment='automatic' THEN 'ambiguous' END
    WHEN 'label_confirmed' THEN CASE WHEN j.status IN ('claimed','ambiguous') THEN 'confirmed' END
    WHEN 'purchase_failed' THEN CASE WHEN j.status='claimed' THEN 'failed' END
    WHEN 'tracking_update' THEN CASE WHEN j.status IN ('confirmed','cancelled') THEN j.status END
    WHEN 'cancellation_requested' THEN CASE WHEN j.status='confirmed' THEN 'confirmed' END
    WHEN 'cancelled' THEN CASE WHEN j.status='confirmed' THEN 'cancelled' END
    WHEN 'cost_adjusted' THEN CASE WHEN j.status IN ('confirmed','cancelled') THEN j.status END
    WHEN 'operator_note' THEN j.status
    WHEN 'unused' THEN CASE WHEN j.status IN ('confirmed','cancelled') THEN j.status END
  END;
  IF v_next IS NULL THEN RAISE EXCEPTION 'label_transition_invalid:%:%', j.status, p_kind; END IF;
  IF p_kind='request_started' AND j.status='claimed' AND EXISTS (SELECT 1 FROM public.marketplace_round_trip_label_events
      WHERE job_id=p_job AND kind='request_started') THEN
    v_next := 'ambiguous';
  END IF;
  IF p_kind='label_confirmed' THEN
    IF nullif(btrim(v_details->>'provider'),'') IS NULL OR nullif(btrim(v_details->>'provider_label_id'),'') IS NULL
      OR nullif(btrim(v_details->>'carrier'),'') IS NULL OR nullif(btrim(v_details->>'tracking'),'') IS NULL
      THEN RAISE EXCEPTION 'label_details_required'; END IF;
    IF (j.fulfilment='manual') <> (v_details->>'provider' = 'manual') THEN RAISE EXCEPTION 'label_provider_mismatch'; END IF;
    IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='round-trip-labels-private' AND name=j.id::text||'/label.pdf') THEN
      RAISE EXCEPTION 'label_object_missing';
    END IF;
    v_charged := (v_details->>'charged_cost_ttc_cents')::integer;
    IF j.fulfilment='manual' THEN
      IF v_charged IS NULL OR v_charged < 0 THEN RAISE EXCEPTION 'charged_cost_required'; END IF;
      IF nullif(btrim(v_details->>'method'),'') IS NULL THEN RAISE EXCEPTION 'method_required'; END IF;
      SELECT coalesce(sum(charged_cost_ttc_cents),0) INTO v_other FROM public.marketplace_round_trip_label_jobs
        WHERE case_id=j.case_id AND id<>j.id AND status='confirmed';
      IF v_other + v_charged > 1500 THEN
        IF (v_details->>'deficit_acknowledged') IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'deficit_acknowledgement_required'; END IF;
        v_details := v_details || jsonb_build_object('deficit_ttc_cents', v_other + v_charged - 1500);
      END IF;
    ELSE
      SELECT CASE WHEN j.direction='outbound' THEN outbound_cost_ttc_cents ELSE return_cost_ttc_cents END
        INTO v_approved FROM public.marketplace_round_trip_rate_approvals WHERE id=j.rate_approval_id;
      IF v_charged > v_approved THEN
        v_details := v_details || jsonb_build_object('cost_review_required',true,'approved_cost_ttc_cents',v_approved);
      END IF;
    END IF;
    UPDATE public.marketplace_round_trip_label_jobs SET status='confirmed', provider=v_details->>'provider',
      provider_label_id=v_details->>'provider_label_id', carrier=v_details->>'carrier', tracking=v_details->>'tracking',
      method_label=nullif(btrim(v_details->>'method'),''), private_label_path=j.id::text||'/label.pdf',
      charged_cost_ttc_cents=v_charged, updated_at=now() WHERE id=p_job;
  ELSIF p_kind='cancelled' THEN
    IF nullif(btrim(v_details->>'reference'),'') IS NULL THEN RAISE EXCEPTION 'cancellation_reference_required'; END IF;
    UPDATE public.marketplace_round_trip_label_jobs SET status='cancelled', cancelled_at=now(),
      provider_cancellation_reference=v_details->>'reference', updated_at=now() WHERE id=p_job;
  ELSIF p_kind='cost_adjusted' THEN
    UPDATE public.marketplace_round_trip_label_jobs SET
      charged_cost_ttc_cents=coalesce((v_details->>'charged_cost_ttc_cents')::integer,charged_cost_ttc_cents),
      refunded_cost_ttc_cents=coalesce((v_details->>'refunded_cost_ttc_cents')::integer,refunded_cost_ttc_cents),
      updated_at=now() WHERE id=p_job;
  ELSIF v_next IS DISTINCT FROM j.status THEN
    UPDATE public.marketplace_round_trip_label_jobs SET status=v_next, updated_at=now() WHERE id=p_job;
  END IF;
  INSERT INTO public.marketplace_round_trip_label_events(job_id,kind,provider_event_id,details)
    VALUES (p_job,p_kind,p_provider_event_id,v_details);
  RETURN jsonb_build_object('outcome','applied','status',v_next,
    'cost_review_required',coalesce((v_details->>'cost_review_required')::boolean,false),
    'deficit_ttc_cents',(v_details->>'deficit_ttc_cents')::integer);
END $$;

-- Travaux terminés : l'atelier retenu, après réception physique, déclare le retour prêt et
-- mesure le colis retour emballé. Répétable tant qu'aucune étiquette retour n'est active.
CREATE FUNCTION public.marketplace_round_trip_return_ready(
  p_case uuid, p_binder uuid, p_actor uuid, p_weight integer, p_length integer, p_width integer, p_height integer
) RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_work uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.marketplace_binder_members WHERE binder_id=p_binder
    AND user_id=p_actor AND account_status='active') THEN RAISE EXCEPTION 'active_membership_required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.marketplace_case_matches WHERE case_id=p_case AND binder_id=p_binder
    AND state='selected') THEN RAISE EXCEPTION 'selected_workshop_required'; END IF;
  SELECT id INTO v_work FROM public.marketplace_binder_works WHERE case_id=p_case AND binder_id=p_binder FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'work_not_found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.marketplace_work_logistics_events
    WHERE work_id=v_work AND kind='received') THEN RAISE EXCEPTION 'physical_receipt_required'; END IF;
  UPDATE public.marketplace_case_logistics_plans SET return_ready_at=coalesce(return_ready_at,now()),
    return_ready_by=coalesce(return_ready_by,p_actor), return_weight_grams=p_weight, return_length_mm=p_length,
    return_width_mm=p_width, return_height_mm=p_height WHERE case_id=p_case;
  IF NOT FOUND THEN RAISE EXCEPTION 'logistics_plan_required'; END IF;
  RETURN jsonb_build_object('parcel_ok', public.marketplace_round_trip_parcel_ok(p_weight,p_length,p_width,p_height));
END $$;
REVOKE ALL ON FUNCTION public.marketplace_round_trip_return_ready(uuid,uuid,uuid,integer,integer,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_round_trip_return_ready(uuid,uuid,uuid,integer,integer,integer,integer) TO service_role;

REVOKE ALL ON FUNCTION public.marketplace_round_trip_plan_block(public.marketplace_case_logistics_plans,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_round_trip_plan_block(public.marketplace_case_logistics_plans,text,uuid) TO service_role;

-- Retour arrière (avant toute donnée réelle) : DROP des triggers/fonctions/tables ci-dessus,
-- puis rétablir 20261001160000 (contrainte unique, colonnes return_ready_*, fonctions d'origine).
