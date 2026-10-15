-- Résolution opérateur des étiquettes « ambiguës » (audit Sendcloud du 15 octobre 2026, P1-2).
--
-- Avant : un job ambigu ne pouvait devenir ni « échoué » ni « annulé » ; une note ne changeait rien,
-- et le dépôt manuel restait bloqué derrière lui. Le client attendait sans issue.
--
-- Après : l'opérateur peut déclarer, preuve écrite à l'appui (au moins 8 caractères) et identité
-- tracée, que le fournisseur n'a créé aucune étiquette : le job passe « échoué » et le remplacement
-- manuel explicite redevient possible. L'adoption d'une étiquette retrouvée passe par
-- 'label_confirmed', déjà permis depuis « ambigu », après relecture du colis chez le fournisseur.
-- Aucun autre changement de la fonction.

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
    -- Depuis « ambigu » : seulement sur constat écrit de l'opérateur que le fournisseur n'a rien créé.
    WHEN 'purchase_failed' THEN CASE WHEN j.status='claimed' THEN 'failed'
      WHEN j.status='ambiguous' AND v_details->>'resolution'='absent_confirmed'
        AND length(btrim(coalesce(v_details->>'evidence',''))) >= 8
        AND nullif(btrim(v_details->>'actor'),'') IS NOT NULL THEN 'failed' END
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
