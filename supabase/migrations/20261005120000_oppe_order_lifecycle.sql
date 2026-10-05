-- Activité A — commande Oppe de bout en bout (modèle du 5 octobre 2026).
--
-- 1. L'atelier accepte une prestation, une rémunération et un délai : l'accord se fige.
-- 2. Une nouvelle proposition Oppe reprend cet accord (atelier, rémunération, délai) et respecte
--    la marge cible de 25 % du prix de vente HT, sauf dérogation explicite et justifiée.
-- 3. Seul le client accepte, avec une preuve (version des conditions, empreinte du devis).
-- 4. Après paiement, la commande suit son cycle : payée, en réalisation, terminée, annulée.
-- 5. Un atelier défaillant est remplacé avec historique ; le prix client ne bouge jamais.
--
-- Les propositions, offres et paiements existants ne sont pas réécrits : `contract_version`
-- reste NULL sur l'historique, et les gardes ne s'appliquent qu'aux nouvelles écritures.

-- ---------------------------------------------------------------------------
-- 1. Accord atelier
ALTER TABLE public.marketplace_quotes
  ADD COLUMN service_description text,
  ADD COLUMN lead_time_days integer CHECK (lead_time_days IS NULL OR lead_time_days BETWEEN 1 AND 365),
  ADD COLUMN agreement_version text;

-- Une offre acceptée par l'atelier ne change plus : ni prestation, ni rémunération, ni délai.
CREATE FUNCTION public.marketplace_freeze_workshop_agreement() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.accepted_at IS NOT NULL AND OLD.agreement_version IS NOT NULL AND (
       NEW.binder_payout_cents IS DISTINCT FROM OLD.binder_payout_cents
    OR NEW.service_description IS DISTINCT FROM OLD.service_description
    OR NEW.lead_time_days IS DISTINCT FROM OLD.lead_time_days
    OR NEW.agreement_version IS DISTINCT FROM OLD.agreement_version
    OR NEW.accepted_at IS DISTINCT FROM OLD.accepted_at
    OR NEW.binder_id IS DISTINCT FROM OLD.binder_id
    OR NEW.case_id IS DISTINCT FROM OLD.case_id) THEN
    RAISE EXCEPTION 'workshop_agreement_immutable' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER marketplace_freeze_workshop_agreement BEFORE UPDATE ON public.marketplace_quotes
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_freeze_workshop_agreement();

-- L'ancienne réponse ne sert plus qu'au refus : accepter exige désormais un délai.
CREATE OR REPLACE FUNCTION public.marketplace_respond_to_offer(
  p_case_id UUID, p_binder_id UUID, p_accept BOOLEAN, p_reason_code TEXT, p_reason_detail TEXT, p_actor_user_id UUID
) RETURNS public.marketplace_quotes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE updated_offer public.marketplace_quotes;
BEGIN
  IF p_accept THEN
    RAISE EXCEPTION 'workshop_lead_time_required' USING ERRCODE = 'check_violation';
  END IF;
  IF p_reason_code IS NULL OR p_reason_code NOT IN ('payout_insufficient','deadline_impossible','outside_specialty','no_capacity','other') THEN
    RAISE EXCEPTION 'A decline reason is required.' USING ERRCODE = 'check_violation';
  END IF;
  IF p_reason_code = 'other' AND nullif(trim(p_reason_detail), '') IS NULL THEN
    RAISE EXCEPTION 'A decline detail is required for other.' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.marketplace_quotes
  SET state = 'declined', declined_at = now(), accepted_at = NULL,
      decline_reason_code = p_reason_code, decline_reason_detail = nullif(trim(p_reason_detail), ''), updated_at = now()
  WHERE case_id = p_case_id AND binder_id = p_binder_id AND state = 'offered'
  RETURNING * INTO updated_offer;
  IF updated_offer.id IS NULL THEN
    RAISE EXCEPTION 'This offer is no longer available.' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.marketplace_case_matches
  SET state = 'declined', responded_at = now(), declined_at = now(), accepted_at = NULL,
      decline_reason_code = p_reason_code, decline_reason_detail = nullif(trim(p_reason_detail), ''), decline_reason = p_reason_code
  WHERE case_id = p_case_id AND binder_id = p_binder_id AND state = 'offered';
  IF NOT EXISTS (SELECT 1 FROM public.marketplace_quotes WHERE case_id = p_case_id AND state IN ('offered','accepted','selected')) THEN
    UPDATE public.marketplace_cases SET status = 'matching'
    WHERE id = p_case_id AND status IN ('awaiting_binder_response','binder_accepted');
  END IF;
  INSERT INTO public.marketplace_events(case_id, binder_id, actor_user_id, event_type, metadata)
  VALUES (p_case_id, p_binder_id, p_actor_user_id, 'offer_declined', jsonb_build_object('reason_code', p_reason_code));
  RETURN updated_offer;
END $$;

-- L'atelier accepte : prestation et rémunération telles qu'offertes, délai qu'il s'engage à tenir.
CREATE FUNCTION public.marketplace_accept_workshop_offer(
  p_case_id uuid, p_binder_id uuid, p_lead_time_days integer, p_actor_user_id uuid
) RETURNS public.marketplace_quotes
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v public.marketplace_quotes;
BEGIN
  IF p_lead_time_days IS NULL OR p_lead_time_days NOT BETWEEN 1 AND 365 THEN
    RAISE EXCEPTION 'workshop_lead_time_required' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM 1 FROM public.marketplace_cases WHERE id = p_case_id FOR UPDATE;
  UPDATE public.marketplace_quotes
  SET state = 'accepted', accepted_at = now(), declined_at = NULL, lead_time_days = p_lead_time_days,
      agreement_version = 'oppe-workshop-v1', decline_reason_code = NULL, decline_reason_detail = NULL, updated_at = now()
  WHERE case_id = p_case_id AND binder_id = p_binder_id AND state = 'offered'
    AND binder_payout_cents IS NOT NULL AND binder_payout_cents > 0
    AND nullif(btrim(coalesce(service_description, '')), '') IS NOT NULL
  RETURNING * INTO v;
  IF v.id IS NULL THEN
    RAISE EXCEPTION 'This offer is no longer available.' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.marketplace_case_matches
  SET state = 'accepted', responded_at = now(), accepted_at = now(), declined_at = NULL,
      decline_reason_code = NULL, decline_reason_detail = NULL, decline_reason = NULL
  WHERE case_id = p_case_id AND binder_id = p_binder_id AND state = 'offered';
  UPDATE public.marketplace_cases SET status = 'binder_accepted'
  WHERE id = p_case_id AND status = 'awaiting_binder_response';
  INSERT INTO public.marketplace_events(case_id, binder_id, actor_user_id, event_type, metadata)
  VALUES (p_case_id, p_binder_id, p_actor_user_id, 'offer_accepted',
          jsonb_build_object('offer_id', v.id, 'binder_payout_cents', v.binder_payout_cents, 'lead_time_days', v.lead_time_days));
  RETURN v;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Proposition Oppe liée à l'accord atelier
ALTER TABLE public.marketplace_commercial_proposals
  ADD COLUMN contract_version text,
  ADD COLUMN workshop_binder_id uuid REFERENCES public.marketplace_binders(id) ON DELETE RESTRICT,
  ADD COLUMN workshop_offer_id uuid REFERENCES public.marketplace_quotes(id) ON DELETE RESTRICT,
  ADD COLUMN workshop_service_description text,
  ADD COLUMN workshop_lead_time_days integer,
  ADD COLUMN price_derogation_reason text,
  ADD COLUMN sent_at timestamptz;

ALTER TABLE public.marketplace_cases ADD COLUMN pricing_derogation_reason text;

CREATE FUNCTION public.marketplace_bind_proposal_to_agreement() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v public.marketplace_quotes;
BEGIN
  SELECT * INTO v FROM public.marketplace_quotes
    WHERE case_id = NEW.case_id AND state = 'selected' AND agreement_version IS NOT NULL
    ORDER BY selected_at DESC NULLS LAST LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'workshop_agreement_required' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.binder_payout_cents IS DISTINCT FROM v.binder_payout_cents THEN
    RAISE EXCEPTION 'workshop_payout_mismatch' USING ERRCODE = 'check_violation';
  END IF;
  -- Marge brute ≥ 25 % du prix de vente HT de la prestation (transport exclu), sauf dérogation.
  IF NEW.customer_service_price_cents IS NULL
     OR (v.binder_payout_cents::numeric * 10000 > NEW.customer_service_price_cents::numeric * 7500
         AND length(btrim(coalesce(NEW.price_derogation_reason, ''))) < 12) THEN
    RAISE EXCEPTION 'margin_below_target_without_derogation' USING ERRCODE = 'check_violation';
  END IF;
  NEW.contract_version := 'oppe-a-v1';
  NEW.workshop_binder_id := v.binder_id;
  NEW.workshop_offer_id := v.id;
  NEW.workshop_service_description := v.service_description;
  NEW.workshop_lead_time_days := v.lead_time_days;
  RETURN NEW;
END $$;
CREATE TRIGGER b_marketplace_bind_proposal_to_agreement
  BEFORE INSERT ON public.marketplace_commercial_proposals
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_bind_proposal_to_agreement();

-- Les termes figés à la création ne se réécrivent pas avant l'acceptation non plus.
CREATE FUNCTION public.marketplace_freeze_proposal_agreement() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.contract_version IS NOT NULL AND (
       NEW.contract_version IS DISTINCT FROM OLD.contract_version
    OR NEW.workshop_binder_id IS DISTINCT FROM OLD.workshop_binder_id
    OR NEW.workshop_offer_id IS DISTINCT FROM OLD.workshop_offer_id
    OR NEW.workshop_service_description IS DISTINCT FROM OLD.workshop_service_description
    OR NEW.workshop_lead_time_days IS DISTINCT FROM OLD.workshop_lead_time_days
    OR NEW.binder_payout_cents IS DISTINCT FROM OLD.binder_payout_cents
    OR NEW.customer_service_price_cents IS DISTINCT FROM OLD.customer_service_price_cents
    OR NEW.price_derogation_reason IS DISTINCT FROM OLD.price_derogation_reason) THEN
    RAISE EXCEPTION 'proposal_agreement_immutable' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER b_marketplace_freeze_proposal_agreement BEFORE UPDATE ON public.marketplace_commercial_proposals
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_freeze_proposal_agreement();

-- ---------------------------------------------------------------------------
-- 3. Acceptation par le client, et par lui seul
CREATE TABLE public.marketplace_proposal_acceptances (
  proposal_id uuid PRIMARY KEY REFERENCES public.marketplace_commercial_proposals(id) ON DELETE RESTRICT,
  case_id uuid NOT NULL REFERENCES public.marketplace_cases(id) ON DELETE RESTRICT,
  customer_user_id uuid NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  terms_version text NOT NULL CHECK (length(btrim(terms_version)) BETWEEN 1 AND 80),
  snapshot_sha256 text NOT NULL CHECK (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  ip_address text,
  user_agent text
);
ALTER TABLE public.marketplace_proposal_acceptances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_proposal_acceptances FROM anon, authenticated;
GRANT ALL ON public.marketplace_proposal_acceptances TO service_role;

CREATE FUNCTION public.marketplace_forbid_acceptance_changes() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'proposal_acceptance_immutable'; END $$;
CREATE TRIGGER marketplace_proposal_acceptances_append_only
  BEFORE UPDATE OR DELETE ON public.marketplace_proposal_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_forbid_acceptance_changes();

-- Une proposition du modèle A ne passe « acceptée » qu'avec la preuve du client.
CREATE FUNCTION public.marketplace_require_customer_acceptance() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.accepted_at IS NULL AND NEW.accepted_at IS NOT NULL AND OLD.contract_version IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.marketplace_proposal_acceptances a
       JOIN public.marketplace_cases c ON c.id = a.case_id
       WHERE a.proposal_id = NEW.id AND a.case_id = NEW.case_id AND a.customer_user_id = c.customer_user_id
     ) THEN
    RAISE EXCEPTION 'customer_acceptance_required' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER a_marketplace_require_customer_acceptance BEFORE UPDATE ON public.marketplace_commercial_proposals
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_require_customer_acceptance();

CREATE FUNCTION public.marketplace_accept_proposal_as_customer(
  p_proposal_id uuid, p_customer_user_id uuid, p_terms_version text, p_snapshot_sha256 text,
  p_ip_address text, p_user_agent text
) RETURNS text
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_case public.marketplace_cases%ROWTYPE; v_p public.marketplace_commercial_proposals%ROWTYPE; v_latest uuid;
BEGIN
  SELECT * INTO v_p FROM public.marketplace_commercial_proposals WHERE id = p_proposal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'proposal_not_found'; END IF;
  SELECT * INTO v_case FROM public.marketplace_cases WHERE id = v_p.case_id FOR UPDATE;
  IF v_case.customer_user_id IS DISTINCT FROM p_customer_user_id THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_p FROM public.marketplace_commercial_proposals WHERE id = p_proposal_id FOR UPDATE;
  IF v_p.accepted_at IS NOT NULL THEN RETURN 'already_accepted'; END IF;
  IF EXISTS (SELECT 1 FROM public.marketplace_commercial_proposals WHERE case_id = v_p.case_id AND accepted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'proposal_changed';
  END IF;
  SELECT id INTO v_latest FROM public.marketplace_commercial_proposals WHERE case_id = v_p.case_id ORDER BY version DESC LIMIT 1;
  IF v_latest IS DISTINCT FROM v_p.id THEN RAISE EXCEPTION 'proposal_changed'; END IF;
  IF v_p.status <> 'proposed' OR v_p.superseded_at IS NOT NULL OR v_p.tax_validated_at IS NULL THEN
    RAISE EXCEPTION 'not_acceptable';
  END IF;
  INSERT INTO public.marketplace_proposal_acceptances(proposal_id, case_id, customer_user_id, terms_version, snapshot_sha256, ip_address, user_agent)
  VALUES (v_p.id, v_p.case_id, p_customer_user_id, btrim(p_terms_version), p_snapshot_sha256, left(p_ip_address, 64), left(p_user_agent, 400));
  UPDATE public.marketplace_commercial_proposals SET status = 'accepted', accepted_at = now() WHERE id = v_p.id;
  UPDATE public.marketplace_commercial_proposals SET status = 'superseded', superseded_at = now()
    WHERE case_id = v_p.case_id AND id <> v_p.id AND status IN ('draft','proposed');
  UPDATE public.marketplace_cases SET status = 'awaiting_payment'
    WHERE id = v_p.case_id AND status IN ('binder_selected','binder_accepted','matching','pricing');
  INSERT INTO public.marketplace_events(case_id, actor_user_id, event_type, metadata)
  VALUES (v_p.case_id, p_customer_user_id, 'commercial_proposal_accepted',
          jsonb_build_object('proposal_id', v_p.id, 'version', v_p.version, 'accepted_by', 'customer',
                             'terms_version', btrim(p_terms_version), 'snapshot_sha256', p_snapshot_sha256));
  RETURN 'accepted';
END $$;

-- ---------------------------------------------------------------------------
-- 4. Commande payée : cycle de réalisation
CREATE TABLE public.marketplace_oppe_orders (
  proposal_id uuid PRIMARY KEY REFERENCES public.marketplace_commercial_proposals(id) ON DELETE RESTRICT,
  case_id uuid NOT NULL UNIQUE REFERENCES public.marketplace_cases(id) ON DELETE RESTRICT,
  brand text NOT NULL CHECK (brand IN ('MA_RELIURE','FINE_BINDERY')),
  status text NOT NULL DEFAULT 'paid' CHECK (status IN ('paid','in_production','completed','cancelled')),
  paid_at timestamptz NOT NULL,
  in_production_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  confirmation_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'cancelled' OR (cancelled_at IS NOT NULL AND length(btrim(coalesce(cancel_reason,''))) >= 12))
);
ALTER TABLE public.marketplace_oppe_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_oppe_orders FROM anon, authenticated;
GRANT ALL ON public.marketplace_oppe_orders TO service_role;

CREATE TABLE public.marketplace_oppe_order_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.marketplace_oppe_orders(case_id) ON DELETE RESTRICT,
  binder_id uuid NOT NULL REFERENCES public.marketplace_binders(id) ON DELETE RESTRICT,
  offer_id uuid REFERENCES public.marketplace_quotes(id) ON DELETE RESTRICT,
  payout_cents integer NOT NULL CHECK (payout_cents > 0),
  lead_time_days integer,
  service_description text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  end_reason text,
  validated_by uuid,
  CHECK (ended_at IS NULL OR length(btrim(coalesce(end_reason,''))) >= 12)
);
CREATE UNIQUE INDEX marketplace_oppe_order_one_active_assignment
  ON public.marketplace_oppe_order_assignments(case_id) WHERE ended_at IS NULL;
ALTER TABLE public.marketplace_oppe_order_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_oppe_order_assignments FROM anon, authenticated;
GRANT ALL ON public.marketplace_oppe_order_assignments TO service_role;

-- Ouverte une seule fois, par le rapprochement d'un paiement vérifié (webhook).
CREATE FUNCTION public.marketplace_open_oppe_order(p_proposal_id uuid, p_paid_at timestamptz)
RETURNS boolean LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v public.marketplace_commercial_proposals%ROWTYPE; v_new boolean;
BEGIN
  SELECT * INTO v FROM public.marketplace_commercial_proposals WHERE id = p_proposal_id;
  IF NOT FOUND OR v.accepted_at IS NULL THEN RAISE EXCEPTION 'order_requires_accepted_proposal'; END IF;
  PERFORM 1 FROM public.marketplace_cases WHERE id = v.case_id FOR UPDATE;
  INSERT INTO public.marketplace_oppe_orders(proposal_id, case_id, brand, paid_at)
  VALUES (v.id, v.case_id, v.brand, coalesce(p_paid_at, now()))
  ON CONFLICT (proposal_id) DO NOTHING;
  v_new := FOUND;
  IF v_new AND v.workshop_binder_id IS NOT NULL THEN
    INSERT INTO public.marketplace_oppe_order_assignments(case_id, binder_id, offer_id, payout_cents, lead_time_days, service_description)
    VALUES (v.case_id, v.workshop_binder_id, v.workshop_offer_id, v.binder_payout_cents, v.workshop_lead_time_days, v.workshop_service_description);
  END IF;
  IF v_new THEN
    UPDATE public.marketplace_cases SET status = 'paid' WHERE id = v.case_id AND status IN ('awaiting_payment','binder_selected','binder_accepted');
    INSERT INTO public.marketplace_events(case_id, event_type, metadata)
    VALUES (v.case_id, 'oppe_order_opened', jsonb_build_object('proposal_id', v.id));
  END IF;
  RETURN v_new;
END $$;

-- Transitions permises ; l'annulation est réservée à l'administration et toujours motivée.
CREATE FUNCTION public.marketplace_advance_oppe_order(
  p_case_id uuid, p_status text, p_actor_user_id uuid, p_actor_role text, p_reason text
) RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE o public.marketplace_oppe_orders%ROWTYPE; v_binder uuid;
BEGIN
  SELECT * INTO o FROM public.marketplace_oppe_orders WHERE case_id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF p_actor_role = 'admin' THEN
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_actor_user_id AND role = 'admin') THEN RAISE EXCEPTION 'admin_required'; END IF;
  ELSIF p_actor_role = 'binder' THEN
    SELECT binder_id INTO v_binder FROM public.marketplace_oppe_order_assignments WHERE case_id = p_case_id AND ended_at IS NULL;
    IF v_binder IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.marketplace_binder_members m WHERE m.binder_id = v_binder AND m.user_id = p_actor_user_id AND m.account_status = 'active'
    ) THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF p_status = 'cancelled' THEN RAISE EXCEPTION 'admin_required'; END IF;
  ELSE RAISE EXCEPTION 'forbidden';
  END IF;
  IF o.status = p_status THEN RETURN 'unchanged'; END IF;
  IF NOT ((o.status = 'paid' AND p_status IN ('in_production','cancelled'))
       OR (o.status = 'in_production' AND p_status IN ('completed','cancelled'))) THEN
    RAISE EXCEPTION 'order_transition_forbidden';
  END IF;
  UPDATE public.marketplace_oppe_orders SET status = p_status, updated_at = now(),
    in_production_at = CASE WHEN p_status = 'in_production' THEN now() ELSE in_production_at END,
    completed_at = CASE WHEN p_status = 'completed' THEN now() ELSE completed_at END,
    cancelled_at = CASE WHEN p_status = 'cancelled' THEN now() ELSE cancelled_at END,
    cancel_reason = CASE WHEN p_status = 'cancelled' THEN btrim(p_reason) ELSE cancel_reason END
  WHERE case_id = p_case_id;
  UPDATE public.marketplace_cases SET status = CASE p_status WHEN 'in_production' THEN 'in_progress' WHEN 'completed' THEN 'completed' ELSE 'cancelled' END
  WHERE id = p_case_id;
  INSERT INTO public.marketplace_events(case_id, actor_user_id, event_type, metadata)
  VALUES (p_case_id, p_actor_user_id, 'oppe_order_' || p_status, jsonb_build_object('by', p_actor_role, 'reason', nullif(btrim(coalesce(p_reason,'')), '')));
  RETURN p_status;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Réattribution : nouvel atelier, nouveau coût validé par l'administration, prix client inchangé.
CREATE FUNCTION public.marketplace_reassign_oppe_order(
  p_case_id uuid, p_new_binder_id uuid, p_reason text, p_actor_user_id uuid
) RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE o public.marketplace_oppe_orders%ROWTYPE; v public.marketplace_quotes%ROWTYPE; cur public.marketplace_oppe_order_assignments%ROWTYPE; v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_actor_user_id AND role = 'admin') THEN RAISE EXCEPTION 'admin_required'; END IF;
  IF length(btrim(coalesce(p_reason,''))) < 12 THEN RAISE EXCEPTION 'reassignment_reason_required'; END IF;
  SELECT * INTO o FROM public.marketplace_oppe_orders WHERE case_id = p_case_id FOR UPDATE;
  IF NOT FOUND OR o.status NOT IN ('paid','in_production') THEN RAISE EXCEPTION 'order_not_reassignable'; END IF;
  SELECT * INTO cur FROM public.marketplace_oppe_order_assignments WHERE case_id = p_case_id AND ended_at IS NULL FOR UPDATE;
  IF cur.binder_id = p_new_binder_id THEN RAISE EXCEPTION 'reassignment_same_workshop'; END IF;
  SELECT * INTO v FROM public.marketplace_quotes
    WHERE case_id = p_case_id AND binder_id = p_new_binder_id AND state = 'accepted' AND agreement_version IS NOT NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'workshop_agreement_required'; END IF;
  IF cur.id IS NOT NULL THEN
    UPDATE public.marketplace_oppe_order_assignments SET ended_at = now(), end_reason = btrim(p_reason) WHERE id = cur.id;
    UPDATE public.marketplace_quotes SET state = 'cancelled', updated_at = now() WHERE case_id = p_case_id AND binder_id = cur.binder_id AND state = 'selected';
    UPDATE public.marketplace_case_matches SET state = 'cancelled' WHERE case_id = p_case_id AND binder_id = cur.binder_id;
  END IF;
  UPDATE public.marketplace_quotes SET state = 'selected', selected_at = now() WHERE id = v.id;
  UPDATE public.marketplace_case_matches SET state = 'selected', selected_at = now() WHERE case_id = p_case_id AND binder_id = p_new_binder_id;
  INSERT INTO public.marketplace_oppe_order_assignments(case_id, binder_id, offer_id, payout_cents, lead_time_days, service_description, validated_by)
  VALUES (p_case_id, p_new_binder_id, v.id, v.binder_payout_cents, v.lead_time_days, v.service_description, p_actor_user_id)
  RETURNING id INTO v_id;
  INSERT INTO public.marketplace_events(case_id, binder_id, actor_user_id, event_type, metadata)
  VALUES (p_case_id, p_new_binder_id, p_actor_user_id, 'oppe_order_reassigned',
          jsonb_build_object('previous_binder_id', cur.binder_id, 'previous_payout_cents', cur.payout_cents,
                             'new_payout_cents', v.binder_payout_cents, 'reason', btrim(p_reason)));
  RETURN v_id;
END $$;

-- ---------------------------------------------------------------------------
-- Droits : uniquement le serveur.
REVOKE ALL ON FUNCTION public.marketplace_accept_workshop_offer(uuid, uuid, integer, uuid),
  public.marketplace_accept_proposal_as_customer(uuid, uuid, text, text, text, text),
  public.marketplace_open_oppe_order(uuid, timestamptz),
  public.marketplace_advance_oppe_order(uuid, text, uuid, text, text),
  public.marketplace_reassign_oppe_order(uuid, uuid, text, uuid),
  public.marketplace_freeze_workshop_agreement(), public.marketplace_bind_proposal_to_agreement(),
  public.marketplace_freeze_proposal_agreement(), public.marketplace_forbid_acceptance_changes(),
  public.marketplace_require_customer_acceptance()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_accept_workshop_offer(uuid, uuid, integer, uuid),
  public.marketplace_accept_proposal_as_customer(uuid, uuid, text, text, text, text),
  public.marketplace_open_oppe_order(uuid, timestamptz),
  public.marketplace_advance_oppe_order(uuid, text, uuid, text, text),
  public.marketplace_reassign_oppe_order(uuid, uuid, text, uuid)
  TO service_role;

-- Retour arrière (avant toute commande réelle) : DROP des fonctions et triggers ci-dessus, des
-- tables marketplace_oppe_order_assignments, marketplace_oppe_orders,
-- marketplace_proposal_acceptances ; DROP des colonnes ajoutées ; rétablir
-- marketplace_respond_to_offer depuis 20260908210000.
