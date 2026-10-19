\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout='30s';
DO $$ BEGIN IF current_database() !~ '^acl_rehearsal_[0-9]{8}$' OR inet_server_addr()<>'127.0.0.1'::inet THEN RAISE EXCEPTION 'local_copy_required';END IF;END $$;
CREATE FUNCTION pg_temp.assert_transition_refused(job uuid,details jsonb) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN PERFORM public.marketplace_round_trip_label_transition(job,'purchase_failed',NULL,details);
 EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'label_transition_invalid:ambiguous:purchase_failed' THEN RETURN;ELSE RAISE;END IF;END;
 RAISE EXCEPTION 'expected_transition_refusal';
END $$;
SET LOCAL ROLE service_role;
DO $$
DECLARE c uuid;p uuid;b uuid;j uuid;j2 uuid;j3 uuid;result jsonb;
BEGIN
 SELECT case_id,id INTO c,p FROM public.marketplace_commercial_proposals ORDER BY created_at LIMIT 1;
 SELECT id INTO b FROM public.marketplace_binders ORDER BY created_at LIMIT 1;
 IF c IS NULL OR p IS NULL OR b IS NULL THEN RAISE EXCEPTION 'missing_local_fixture_references';END IF;
 -- Existing references are used only inside this rolled-back local transaction. No provider or account call.
 INSERT INTO public.marketplace_round_trip_label_jobs(case_id,proposal_id,binder_id,direction,stripe_payment_intent_id,fulfilment,status)
 VALUES(c,p,b,'outbound','pi_synthetic_resolution','manual','ambiguous') RETURNING id INTO j;
 PERFORM pg_temp.assert_transition_refused(j,'{}');
 PERFORM pg_temp.assert_transition_refused(j,'{"resolution":"absent_confirmed","actor":"synthetic-operator","evidence":"short"}');
 PERFORM pg_temp.assert_transition_refused(j,'{"resolution":"absent_confirmed","evidence":"Synthetic provider absence checked"}');
 PERFORM pg_temp.assert_transition_refused(j,'{"resolution":"absent_confirmed","actor":"   ","evidence":"Synthetic provider absence checked"}');
 PERFORM pg_temp.assert_transition_refused(j,'{"resolution":"not_checked","actor":"synthetic-operator","evidence":"Synthetic provider absence checked"}');
 result:=public.marketplace_round_trip_label_transition(j,'purchase_failed','synthetic-resolution-event','{"resolution":"absent_confirmed","actor":"synthetic-operator","evidence":"Synthetic provider absence checked"}');
 IF result->>'status'<>'failed' OR (SELECT status FROM public.marketplace_round_trip_label_jobs WHERE id=j)<>'failed' THEN RAISE EXCEPTION 'valid_resolution_failed';END IF;
 result:=public.marketplace_round_trip_label_transition(j,'purchase_failed','synthetic-resolution-event','{}');
 IF result->>'outcome'<>'duplicate' OR (SELECT count(*) FROM public.marketplace_round_trip_label_events WHERE job_id=j)<>1 THEN RAISE EXCEPTION 'resolution_duplicate';END IF;
 INSERT INTO public.marketplace_round_trip_label_jobs(case_id,proposal_id,binder_id,direction,stripe_payment_intent_id,fulfilment,status)
 VALUES(c,p,b,'outbound','pi_synthetic_claimed','manual','claimed') RETURNING id INTO j2;
 result:=public.marketplace_round_trip_label_transition(j2,'purchase_failed',NULL,'{}');
 IF result->>'status'<>'failed' THEN RAISE EXCEPTION 'claimed_failure_regressed';END IF;
 INSERT INTO public.marketplace_round_trip_label_jobs(case_id,proposal_id,binder_id,direction,stripe_payment_intent_id,fulfilment,status)
 VALUES(c,p,b,'outbound','pi_synthetic_missing_pdf','manual','ambiguous') RETURNING id INTO j3;
 BEGIN
  PERFORM public.marketplace_round_trip_label_transition(j3,'label_confirmed',NULL,'{"provider":"manual","provider_label_id":"synthetic-label","carrier":"synthetic-carrier","tracking":"synthetic-tracking","method":"synthetic-method","charged_cost_ttc_cents":0}');
  RAISE EXCEPTION 'missing_pdf_guard_regressed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'label_object_missing' THEN RAISE;END IF;END;
END $$;
ROLLBACK;
SELECT 'native_label_resolution_tests_passed';
