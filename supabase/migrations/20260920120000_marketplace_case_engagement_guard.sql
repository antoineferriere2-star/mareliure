-- Phase 0 / P1-4 + P1-5 — une seule autorité de prix, et un dossier engagé ne revient jamais
-- silencieusement au chiffrage.
--
-- P1-5. Défaut corrigé : rien en base n'empêchait un dossier dont la proposition était acceptée, ou dont
-- l'atelier était retenu, de repartir en « pricing » / « matching » — `marketplace_validate_pricing`
-- écrivait `status = 'matching'` sur tout dossier non annulé, et le serveur écrivait `status = 'pricing'`
-- de partout. Ici le contrôle est TRANSACTIONNEL, en base, pour tous les écrivains :
--
--   * un dossier ENGAGÉ (une proposition acceptée, ou un atelier retenu : binder_selected et au-delà)
--     ne peut plus reculer en under_review / pricing / matching / awaiting_binder_response /
--     binder_accepted, et ses conditions commerciales (prix, rémunération atelier, acompte, mode de
--     chiffrage…) ne peuvent plus changer. Une évolution est une NOUVELLE VERSION de proposition ;
--   * un dossier dont des offres sont en cours peut re-sélectionner (matching), pas revenir en
--     chiffrage ; l'annulation reste régie par l'automate applicatif (CANCELLABLE) et n'est pas touchée.
--
-- P1-4. `marketplace_validate_pricing` recopie désormais le prix validé dans `service_price_cents` À
-- CHAQUE validation (avant : seulement s'il était vide). `suggested_customer_price_cents` reste la trace
-- de la suggestion initiale du moteur ; la correction humaine se lit dans l'écart. Le serveur construit
-- une proposition sur `customer_price_cents` validé (authoritativePrice.ts), plus sur `service_price_cents`.
--
-- Additive et rejouable : un trigger et une fonction remplacée (même signature, mêmes droits). Aucune
-- donnée réécrite. Le trigger ne s'applique qu'aux mises à jour à venir.

CREATE OR REPLACE FUNCTION public.marketplace_cases_guard_engagement()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_accepted BOOLEAN;
  v_committed BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.marketplace_commercial_proposals p
    WHERE p.case_id = OLD.id AND p.accepted_at IS NOT NULL
  ) INTO v_accepted;
  v_committed := OLD.status IN (
    'binder_selected', 'awaiting_payment', 'paid', 'shipping_to_binder', 'received_by_binder',
    'in_progress', 'awaiting_approval', 'shipping_to_customer', 'delivered', 'completed'
  );

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Engagé (atelier retenu) : aucun retour vers une étape de sélection ou de chiffrage.
    IF v_committed AND NEW.status IN ('under_review', 'pricing', 'matching', 'awaiting_binder_response', 'binder_accepted') THEN
      RAISE EXCEPTION 'case_engaged: case % is committed (%) and cannot return to %', OLD.id, OLD.status, NEW.status
        USING ERRCODE = 'check_violation';
    END IF;
    -- Proposition acceptée : jamais de retour en chiffrage (re-sélectionner un atelier reste possible).
    IF v_accepted AND NEW.status IN ('under_review', 'pricing') THEN
      RAISE EXCEPTION 'case_engaged: case % has an accepted proposal and cannot return to %', OLD.id, NEW.status
        USING ERRCODE = 'check_violation';
    END IF;
    -- Les seules origines légitimes d'un retour vers le chiffrage : les étapes de chiffrage elles-mêmes.
    IF NEW.status IN ('under_review', 'pricing') AND OLD.status NOT IN ('under_review', 'pricing', 'matching') THEN
      RAISE EXCEPTION 'case_engaged: case % (%) cannot return to %', OLD.id, OLD.status, NEW.status
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.status = 'matching' AND OLD.status = 'cancelled' THEN
      RAISE EXCEPTION 'case_engaged: case % is cancelled', OLD.id USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Conditions commerciales figées dès qu'une proposition est acceptée ou qu'un atelier est retenu.
  IF (v_accepted OR v_committed) AND (
       NEW.customer_price_cents IS DISTINCT FROM OLD.customer_price_cents
    OR NEW.binder_payout_cents IS DISTINCT FROM OLD.binder_payout_cents
    OR NEW.service_price_cents IS DISTINCT FROM OLD.service_price_cents
    OR NEW.base_service_price_cents IS DISTINCT FROM OLD.base_service_price_cents
    OR NEW.brand_multiplier_bps IS DISTINCT FROM OLD.brand_multiplier_bps
    OR NEW.deposit_cents IS DISTINCT FROM OLD.deposit_cents
    OR NEW.pricing_status IS DISTINCT FROM OLD.pricing_status
    OR NEW.pricing_mode IS DISTINCT FROM OLD.pricing_mode
    OR NEW.pricing_currency IS DISTINCT FROM OLD.pricing_currency
  ) THEN
    RAISE EXCEPTION 'case_engaged: the commercial terms of case % are frozen (new proposal version required)', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketplace_cases_guard_engagement ON public.marketplace_cases;
CREATE TRIGGER marketplace_cases_guard_engagement
  BEFORE UPDATE ON public.marketplace_cases
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_cases_guard_engagement();

-- Même fonction, même signature, mêmes droits (CREATE OR REPLACE) — deux changements :
--   1. refus net (`case_engaged`) hors des étapes de chiffrage, ou si une proposition est acceptée ;
--   2. le prix validé est recopié dans `service_price_cents` à chaque validation.
CREATE OR REPLACE FUNCTION public.marketplace_validate_pricing(
  p_case_id UUID,
  p_customer_price_cents INTEGER,
  p_binder_payout_cents INTEGER,
  p_price_includes TEXT[],
  p_minimum_margin_bps INTEGER,
  p_minimum_margin_cents INTEGER,
  p_actor_user_id UUID
) RETURNS public.marketplace_cases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_case public.marketplace_cases;
  current_case public.marketplace_cases;
  actual_margin INTEGER;
  required_margin INTEGER;
BEGIN
  IF p_customer_price_cents <= 0 OR p_binder_payout_cents <= 0
     OR p_binder_payout_cents > p_customer_price_cents THEN
    RAISE EXCEPTION 'Invalid managed price.' USING ERRCODE = 'check_violation';
  END IF;
  actual_margin := p_customer_price_cents - p_binder_payout_cents;
  required_margin := greatest(
    p_minimum_margin_cents,
    ceil(p_customer_price_cents * p_minimum_margin_bps / 10000.0)::integer
  );
  IF actual_margin < required_margin THEN
    RAISE EXCEPTION 'Managed price is below the configured minimum margin.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO current_case FROM public.marketplace_cases WHERE id = p_case_id FOR UPDATE;
  IF current_case.id IS NULL THEN
    RAISE EXCEPTION 'Case is unavailable or still requires manual review.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF current_case.status NOT IN ('under_review', 'pricing', 'matching')
     OR EXISTS (
       SELECT 1 FROM public.marketplace_commercial_proposals p
       WHERE p.case_id = p_case_id AND p.accepted_at IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'case_engaged: the price of case % can no longer be validated (status %)', p_case_id, current_case.status
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.marketplace_cases
  SET customer_price_cents = p_customer_price_cents,
      service_price_cents = p_customer_price_cents,
      binder_payout_cents = p_binder_payout_cents,
      price_includes = coalesce(p_price_includes, '{}'),
      pricing_status = 'validated',
      pricing_validated_at = now(),
      pricing_validated_by = p_actor_user_id,
      status = 'matching'
  WHERE id = p_case_id
    AND manual_review_required = false
    AND status <> 'cancelled'
  RETURNING * INTO updated_case;

  IF updated_case.id IS NULL THEN
    RAISE EXCEPTION 'Case is unavailable or still requires manual review.'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.marketplace_events(case_id, actor_user_id, event_type, metadata)
  VALUES (
    p_case_id,
    p_actor_user_id,
    'pricing_validated',
    jsonb_build_object(
      'customer_price_cents', p_customer_price_cents,
      'binder_payout_cents', p_binder_payout_cents,
      'suggested_customer_price_cents', current_case.suggested_customer_price_cents,
      'previous_customer_price_cents', current_case.customer_price_cents
    )
  );
  RETURN updated_case;
END;
$$;

-- ---------------------------------------------------------------------------
-- Retour arrière
--
-- DROP TRIGGER IF EXISTS marketplace_cases_guard_engagement ON public.marketplace_cases;
-- DROP FUNCTION IF EXISTS public.marketplace_cases_guard_engagement();
-- (rejouer la définition de marketplace_validate_pricing de 20260908210000 pour revenir à l'ancienne fonction)
-- ---------------------------------------------------------------------------
