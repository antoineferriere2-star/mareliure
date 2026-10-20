-- Tarifs aller-retour versionnés (audit Sendcloud du 15 octobre 2026, P1-1 et P1-3).
--
-- Avant : un seul tarif par dossier et proposition (UNIQUE), sans mise à jour possible. Un tarif
-- expiré ne pouvait plus être renouvelé, et même la reprise d'un achat déjà commencé était refusée
-- après son échéance — alors que le retour du livre arrive souvent des semaines plus tard.
--
-- Après :
-- - chaque revue tarifaire est une nouvelle ligne, jamais modifiée ; la plus récente fait foi ;
-- - une réservation existante (achat en cours, ambigu ou confirmé) se reprend sans exiger un tarif
--   en vigueur : récupérer une étiquette déjà achetée n'est pas un nouvel achat ;
-- - un NOUVEL achat exige un tarif en vigueur dont poids et dimensions sont ceux du colis réel de ce
--   trajet ; sinon l'admin enregistre un nouveau tarif.

ALTER TABLE public.marketplace_round_trip_rate_approvals
  DROP CONSTRAINT IF EXISTS marketplace_round_trip_rate_approvals_case_id_proposal_id_key;
CREATE INDEX IF NOT EXISTS marketplace_round_trip_rate_approvals_current
  ON public.marketplace_round_trip_rate_approvals (case_id, proposal_id, reviewed_at DESC);

DROP FUNCTION public.marketplace_reserve_round_trip_label(uuid,text,text,text);
CREATE FUNCTION public.marketplace_reserve_round_trip_label(
  p_case uuid, p_direction text, p_outbound_address_sha256 text, p_return_address_sha256 text
) RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_ctx jsonb; v_rate public.marketplace_round_trip_rate_approvals%ROWTYPE;
  v_job public.marketplace_round_trip_label_jobs%ROWTYPE; v_plan public.marketplace_case_logistics_plans%ROWTYPE;
  v_weight integer; v_dims integer[];
BEGIN
  IF NOT (SELECT enabled FROM public.marketplace_round_trip_automation WHERE id) THEN RAISE EXCEPTION 'automation_closed'; END IF;
  v_ctx := public.marketplace_round_trip_leg_context(p_case, p_direction);

  -- Reprise d'abord : une réservation existante ne dépend pas de la validité d'un tarif.
  SELECT * INTO v_job FROM public.marketplace_round_trip_label_jobs WHERE case_id = p_case AND direction = p_direction
    ORDER BY (status IN ('claimed','ambiguous','confirmed')) DESC, created_at DESC LIMIT 1;
  IF FOUND THEN
    IF v_job.proposal_id::text <> v_ctx->>'proposal_id' OR v_job.stripe_payment_intent_id <> v_ctx->>'payment_intent' THEN
      RAISE EXCEPTION 'reservation_conflict';
    END IF;
    RETURN jsonb_build_object('outcome', CASE WHEN v_job.status = 'confirmed' THEN 'existing' ELSE 'review_required' END,
      'id', v_job.id, 'status', v_job.status, 'fulfilment', v_job.fulfilment);
  END IF;

  -- Nouvel achat : colis dans le plafond, tarif le plus récent, en vigueur, mêmes adresses et même colis.
  IF NOT (v_ctx->>'parcel_ok')::boolean THEN RAISE EXCEPTION 'return_parcel_review_required'; END IF;
  SELECT * INTO v_rate FROM public.marketplace_round_trip_rate_approvals
    WHERE case_id = p_case AND proposal_id = (v_ctx->>'proposal_id')::uuid AND binder_id = (v_ctx->>'binder_id')::uuid
    ORDER BY reviewed_at DESC, id DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR v_rate.valid_until <= now() THEN RAISE EXCEPTION 'current_rate_approval_required'; END IF;
  IF p_outbound_address_sha256 IS DISTINCT FROM v_rate.outbound_address_sha256
    OR p_return_address_sha256 IS DISTINCT FROM v_rate.return_address_sha256 THEN
    RAISE EXCEPTION 'address_changed_review_required';
  END IF;
  SELECT * INTO v_plan FROM public.marketplace_case_logistics_plans WHERE case_id = p_case;
  IF p_direction = 'outbound' THEN
    v_weight := v_plan.parcel_weight_grams;
    v_dims := ARRAY[v_plan.parcel_length_mm, v_plan.parcel_width_mm, v_plan.parcel_height_mm];
  ELSE
    v_weight := v_plan.return_weight_grams;
    v_dims := ARRAY[v_plan.return_length_mm, v_plan.return_width_mm, v_plan.return_height_mm];
  END IF;
  v_dims := (SELECT array_agg(x ORDER BY x DESC) FROM unnest(v_dims) AS x);
  IF v_weight IS DISTINCT FROM (CASE WHEN p_direction = 'outbound' THEN v_rate.outbound_weight_grams ELSE v_rate.return_weight_grams END)
    OR v_dims IS DISTINCT FROM (CASE WHEN p_direction = 'outbound' THEN v_rate.outbound_dimensions_mm ELSE v_rate.return_dimensions_mm END) THEN
    RAISE EXCEPTION 'parcel_changed_rate_review_required';
  END IF;

  INSERT INTO public.marketplace_round_trip_label_jobs
    (case_id, proposal_id, rate_approval_id, binder_id, direction, stripe_payment_intent_id, fulfilment)
    VALUES (p_case, (v_ctx->>'proposal_id')::uuid, v_rate.id, (v_ctx->>'binder_id')::uuid, p_direction,
      v_ctx->>'payment_intent', 'automatic') RETURNING * INTO v_job;
  RETURN jsonb_build_object('outcome', 'claim', 'id', v_job.id);
END $$;
REVOKE ALL ON FUNCTION public.marketplace_reserve_round_trip_label(uuid,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_reserve_round_trip_label(uuid,text,text,text) TO service_role;
