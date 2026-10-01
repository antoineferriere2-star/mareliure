-- qwf, BEGIN … ROLLBACK : aucune donnée conservée. Parcours aller-retour #54 sur la base hébergée.
CREATE TEMP TABLE r(n serial, scenario text, expected text, observed text, pass boolean);
CREATE FUNCTION pg_temp.expect(p_scenario text, p_sql text, p_expected text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  BEGIN EXECUTE p_sql; v := 'ok'; EXCEPTION WHEN OTHERS THEN v := SQLERRM; END;
  INSERT INTO r(scenario,expected,observed,pass) VALUES(p_scenario,p_expected,v,CASE WHEN p_expected='ok' THEN v='ok' ELSE v LIKE '%'||p_expected||'%' END);
END $$;
CREATE FUNCTION pg_temp.check(p_scenario text, p_observed text, p_expected text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO r(scenario,expected,observed,pass) VALUES(p_scenario,p_expected,p_observed,p_observed IS NOT DISTINCT FROM p_expected) $$;

DO $$
DECLARE c uuid := 'dae7e3ed-0000-0000-0000-000000000000'; p uuid; b uuid; member uuid; reviewer uuid; w uuid := gen_random_uuid();
  a text := repeat('a',64); z text := repeat('b',64); out_job uuid; ret_job uuid; res jsonb;
BEGIN
  SELECT id,case_id INTO p,c FROM marketplace_commercial_proposals WHERE id::text LIKE 'a4fd1597%';
  -- La proposition historique acceptée est immuable : on le vérifie, puis on clone le dossier.
  PERFORM pg_temp.expect('Proposition acceptée historique : offre impossible (immuable)',format($f$UPDATE marketplace_commercial_proposals SET shipping_offer_kind='book_round_trip_fr',shipping_total_cents=1250,shipping_other_cents=1250 WHERE id=%L$f$,p),'immutable once accepted');
  PERFORM pg_temp.expect('Proposition historique : pas d''offre aller-retour',format('SELECT marketplace_reserve_round_trip_label(%L,%L,%L,%L)',c,'outbound',repeat('a',64),repeat('b',64)),'round_trip_offer_required');
  DECLARE nd uuid := gen_random_uuid(); nc uuid := gen_random_uuid(); np uuid := gen_random_uuid(); old_d uuid;
  BEGIN
    SELECT dossier_id INTO old_d FROM marketplace_cases WHERE id=c;
    INSERT INTO build_dossiers SELECT (jsonb_populate_record(NULL::build_dossiers, to_jsonb(d) || jsonb_build_object('id',nd,'session_id',NULL,'mission_id',NULL))).* FROM build_dossiers d WHERE d.id=old_d;
    INSERT INTO marketplace_cases SELECT (jsonb_populate_record(NULL::marketplace_cases, to_jsonb(x) || jsonb_build_object('id',nc,'dossier_id',nd,'reference','QA-PR54-'||left(nc::text,6)))).* FROM marketplace_cases x WHERE x.id=c;
    INSERT INTO marketplace_case_matches SELECT (jsonb_populate_record(NULL::marketplace_case_matches, to_jsonb(m) || jsonb_build_object('id',gen_random_uuid(),'case_id',nc,'accepted_at',NULL))).* FROM marketplace_case_matches m WHERE m.case_id=c AND m.state='selected';
    INSERT INTO marketplace_commercial_proposals SELECT (jsonb_populate_record(NULL::marketplace_commercial_proposals, to_jsonb(o) || jsonb_build_object('id',np,'case_id',nc,'version',1,
      'shipping_offer_kind','book_round_trip_fr','shipping_total_cents',1250,'shipping_other_cents',1250,'shipping_outbound_cents',0,'shipping_return_cents',0,'payment_provenance',NULL,'customer_total_ht_cents',o.customer_service_price_cents+1250,'customer_vat_amount_cents',round((o.customer_service_price_cents+1250)*0.2),'customer_total_ttc_cents',(o.customer_service_price_cents+1250)+round((o.customer_service_price_cents+1250)*0.2),'balance_due_cents',(o.customer_service_price_cents+1250)+round((o.customer_service_price_cents+1250)*0.2)))).* FROM marketplace_commercial_proposals o WHERE o.id=p;
    c := nc; p := np;
  END;
  SELECT binder_id INTO b FROM marketplace_case_matches WHERE case_id=c AND state='selected';
  SELECT user_id INTO member FROM marketplace_binder_members WHERE binder_id=b AND account_status='active' LIMIT 1;
  SELECT user_id INTO reviewer FROM user_roles WHERE role='admin' LIMIT 1;
  reviewer := coalesce(reviewer, member);
  PERFORM pg_temp.check('Nouvelle proposition acceptée avec l''offre',(SELECT shipping_offer_kind||'/'||status FROM marketplace_commercial_proposals WHERE id=p),'book_round_trip_fr/accepted');
  PERFORM pg_temp.expect('Sans paiement plateforme confirmé : aucune réservation',format('SELECT marketplace_reserve_round_trip_label(%L,%L,%L,%L)',c,'outbound',a,z),'platform_payment_required');
  INSERT INTO marketplace_commercial_proposal_payments(proposal_id,stripe_checkout_session_id,stripe_payment_intent_id,paid_at,amount_paid_cents,paid_currency)
    VALUES(p,'cs_test_qa_pr54','pi_test_qa_pr54',now(),(SELECT customer_total_ttc_cents-1 FROM marketplace_commercial_proposals WHERE id=p),'eur');
  PERFORM pg_temp.expect('Paiement incomplet : aucune réservation',format('SELECT marketplace_reserve_round_trip_label(%L,%L,%L,%L)',c,'outbound',a,z),'platform_payment_required');
  UPDATE marketplace_commercial_proposal_payments SET amount_paid_cents=(SELECT customer_total_ttc_cents FROM marketplace_commercial_proposals WHERE id=p) WHERE proposal_id=p;
  PERFORM pg_temp.expect('Atelier sélectionné non acceptant : aucune réservation',format('SELECT marketplace_reserve_round_trip_label(%L,%L,%L,%L)',c,'outbound',a,z),'accepted_workshop_required');
  UPDATE marketplace_case_matches SET accepted_at=now() WHERE case_id=c AND binder_id=b;
  PERFORM pg_temp.expect('Sans tarif revu : aucune réservation',format('SELECT marketplace_reserve_round_trip_label(%L,%L,%L,%L)',c,'outbound',a,z),'current_rate_approval_required');
  INSERT INTO marketplace_round_trip_rate_approvals(case_id,proposal_id,binder_id,outbound_address_sha256,return_address_sha256,outbound_weight_grams,return_weight_grams,
    outbound_dimensions_mm,return_dimensions_mm,outbound_method,return_method,provider_quote_reference,coverage_evidence_reference,outbound_cost_ttc_cents,
    return_cost_ttc_cents,all_other_costs_ttc_cents,estimated_economic_cost_cents,economic_cost_evidence_reference,valid_until,reviewed_by)
  VALUES(c,p,b,a,z,500,500,ARRAY[350,250,80],ARRAY[350,250,80],'QA relais','QA relais','QA devis fictif','QA couverture fictive',410,410,0,700,'QA coût fictif',now()+interval '1 day',reviewer);
  PERFORM pg_temp.expect('Tarif au-delà de 15 € refusé (contrainte)',format($f$INSERT INTO marketplace_round_trip_rate_approvals(case_id,proposal_id,binder_id,outbound_address_sha256,return_address_sha256,outbound_weight_grams,return_weight_grams,outbound_dimensions_mm,return_dimensions_mm,outbound_method,return_method,provider_quote_reference,coverage_evidence_reference,outbound_cost_ttc_cents,return_cost_ttc_cents,all_other_costs_ttc_cents,estimated_economic_cost_cents,economic_cost_evidence_reference,valid_until,reviewed_by) VALUES(%L,%L,%L,%L,%L,500,500,ARRAY[350,250,80],ARRAY[350,250,80],'x x x','x x x','x x x','x x x',800,800,0,700,'x x x',now()+interval '1 day',%L)$f$,c,p,b,a,z,reviewer),'round_trip_no_automatic_deficit');
  PERFORM pg_temp.expect('Adresse modifiée : revue exigée',format('SELECT marketplace_reserve_round_trip_label(%L,%L,%L,%L)',c,'outbound',z,z),'address_changed_review_required');
  res := marketplace_reserve_round_trip_label(c,'outbound',a,z); out_job := (res->>'id')::uuid;
  PERFORM pg_temp.check('Réservation aller',res->>'outcome','claim');
  PERFORM pg_temp.check('Seconde demande : revue, jamais un second achat',marketplace_reserve_round_trip_label(c,'outbound',a,z)->>'outcome','review_required');
  PERFORM pg_temp.check('Une seule ligne pour l''aller',(SELECT count(*)::text FROM marketplace_round_trip_label_jobs WHERE case_id=c AND direction='outbound'),'1');
  PERFORM pg_temp.check('Tentative enregistrée',marketplace_round_trip_label_transition(out_job,'request_started',NULL,'{"provider":"sendcloud"}')->>'status','claimed');
  PERFORM pg_temp.check('Réponse perdue : ambigu',marketplace_round_trip_label_transition(out_job,'response_ambiguous',NULL,'{"code":"timeout"}')->>'status','ambiguous');
  PERFORM pg_temp.expect('Échec définitif refusé après ambiguïté',format('SELECT marketplace_round_trip_label_transition(%L,%L,NULL,%L)',out_job,'purchase_failed','{"code":"x"}'),'label_transition_invalid');
  PERFORM pg_temp.expect('Détails privés refusés',format('SELECT marketplace_round_trip_label_transition(%L,%L,NULL,%L)',out_job,'operator_note','{"address":"1 rue"}'),'private_details_refused');
  res := marketplace_round_trip_label_transition(out_job,'label_confirmed',NULL,'{"provider":"sendcloud","provider_label_id":"qa-pr54-1","carrier":"qa","tracking":"QA54","charged_cost_ttc_cents":450}');
  PERFORM pg_temp.check('Étiquette confirmée, surcoût signalé',res->>'status'||'/'||(res->>'cost_review_required'),'confirmed/true');
  PERFORM pg_temp.check('Chemin privé contrôlé',(SELECT private_label_path FROM marketplace_round_trip_label_jobs WHERE id=out_job),out_job::text||'/label.pdf');
  PERFORM pg_temp.check('Suivi transporteur dédupliqué',marketplace_round_trip_label_transition(out_job,'tracking_update','qa-pr54-1:1','{"code":"in_transit"}')->>'outcome'||'/'||(marketplace_round_trip_label_transition(out_job,'tracking_update','qa-pr54-1:1','{"code":"in_transit"}')->>'outcome'),'applied/duplicate');
  PERFORM pg_temp.expect('Retour avant réception physique refusé',format('SELECT marketplace_reserve_round_trip_label(%L,%L,%L,%L)',c,'return',a,z),'return_not_ready');
  INSERT INTO marketplace_binder_works(id,binder_id,reference,title,source,case_id) VALUES(w,b,'QA-PR54-W','Livre fictif QA','ma_reliure',c);
  PERFORM marketplace_work_logistics(w,b,member,'append',jsonb_build_object('id',gen_random_uuid(),'version',0,'kind','outbound','details',jsonb_build_object('mode','parcel','carrier','qa','tracking','QA54')));
  PERFORM marketplace_work_logistics(w,b,member,'append',jsonb_build_object('id',gen_random_uuid(),'version',1,'kind','carrier_delivered','details',jsonb_build_object('proof','Preuve transporteur QA')));
  PERFORM pg_temp.expect('Livraison transporteur ≠ réception : retour refusé',format('SELECT marketplace_mark_round_trip_return_ready(%L,%L,%L)',c,b,member),'physical_receipt_required');
  PERFORM marketplace_work_logistics(w,b,member,'append',jsonb_build_object('id',gen_random_uuid(),'version',2,'kind','received','details',jsonb_build_object('condition','consistent')));
  PERFORM pg_temp.expect('Réception physique confirmée par l''atelier',format('SELECT marketplace_mark_round_trip_return_ready(%L,%L,%L)',c,b,member),'ok');
  res := marketplace_reserve_round_trip_label(c,'return',a,z); ret_job := (res->>'id')::uuid;
  PERFORM pg_temp.check('Réservation retour',res->>'outcome','claim');
  PERFORM pg_temp.expect('Annulation sans référence refusée',format('SELECT marketplace_round_trip_label_transition(%L,%L,NULL,%L)',out_job,'cancelled','{}'),'cancellation_reference_required');
  PERFORM pg_temp.check('Annulation enregistrée, aucun remboursement présumé',marketplace_round_trip_label_transition(out_job,'cancelled',NULL,'{"reference":"qa-cancel"}')->>'status'||'/'||coalesce((SELECT refunded_cost_ttc_cents::text FROM marketplace_round_trip_label_jobs WHERE id=out_job),'null'),'cancelled/null');
  PERFORM pg_temp.check('Journal ajouté seulement',(SELECT string_agg(kind,',' ORDER BY created_at) FROM marketplace_round_trip_label_events WHERE job_id=out_job),'request_started,response_ambiguous,label_confirmed,tracking_update,cancelled');
END $$;
GRANT INSERT ON r TO authenticated; GRANT USAGE ON SEQUENCE r_n_seq TO authenticated;
SET ROLE authenticated;
SELECT pg_temp.expect('Navigateur : réservation refusée',$f$SELECT marketplace_reserve_round_trip_label('00000000-0000-4000-8000-000000000000','outbound','a','b')$f$,'permission denied');
SELECT pg_temp.expect('Navigateur : transition refusée',$f$SELECT marketplace_round_trip_label_transition('00000000-0000-4000-8000-000000000000','operator_note',NULL,'{}')$f$,'permission denied');
SELECT pg_temp.expect('Navigateur : lecture des réservations refusée',$f$SELECT * FROM marketplace_round_trip_label_jobs$f$,'permission denied');
RESET ROLE;
SELECT jsonb_build_object('n',n,'pass',pass,'scenario',scenario,'expected',expected,'observed',left(observed,90)) FROM r ORDER BY n;
