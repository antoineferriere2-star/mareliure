-- qwf, BEGIN … ROLLBACK : aucune donnée conservée. Refus et reprises du parcours sur les dossiers RL-QA-K*.
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
DECLARE k1 uuid; k2 uuid; k3 uuid; k4 uuid; admin uuid := '33bc4a8e-2e59-4799-9ca6-59dacd635fb5';
  member uuid := 'fe4ef1b4-887b-47f8-b2b8-088e51f13ba5'; draft_member uuid := '32db49b2-2cce-4db1-b382-136bb63d139c';
  binder uuid := 'f5302e8e-1b98-40d2-bf2e-0c88f4a1adea'; draft_binder uuid := 'd6c095c0-2cff-4ee9-9393-8891c5d8c03c';
  out_job uuid; ret_job uuid; res jsonb; new_ret uuid; evidence jsonb;
BEGIN
  SELECT id INTO k1 FROM marketplace_cases WHERE reference='RL-QA-K1';
  SELECT id INTO k2 FROM marketplace_cases WHERE reference='RL-QA-K2';
  SELECT id INTO k3 FROM marketplace_cases WHERE reference='RL-QA-K3';
  SELECT id INTO k4 FROM marketplace_cases WHERE reference='RL-QA-K4';
  SELECT id INTO out_job FROM marketplace_round_trip_label_jobs WHERE case_id=k1 AND direction='outbound' AND status='confirmed';
  SELECT id INTO ret_job FROM marketplace_round_trip_label_jobs WHERE case_id=k1 AND direction='return' AND status='confirmed';
  PERFORM pg_temp.check('État de départ K1 : deux étiquettes manuelles confirmées', (out_job IS NOT NULL AND ret_job IS NOT NULL)::text, 'true');

  -- Contrat figé.
  PERFORM pg_temp.expect('K1 accepté : plan logistique figé', format($q$UPDATE marketplace_case_logistics_plans SET city='Lille', postal_code='59000' WHERE case_id=%L$q$, k1), 'logistics_plan_locked');
  PERFORM pg_temp.expect('K1 accepté : produit transport de la proposition immuable', format($q$UPDATE marketplace_commercial_proposals SET shipping_offer_kind='manual' WHERE case_id=%L AND accepted_at IS NOT NULL$q$, k1), 'immutable');
  PERFORM pg_temp.expect('K1 accepté : accord de réception de l''atelier figé', format($q$UPDATE marketplace_case_logistics_plans SET workshop_decision='declined', workshop_reception_name=NULL, workshop_address_line1=NULL, workshop_postal_code=NULL, workshop_city=NULL, workshop_country_code=NULL WHERE case_id=%L$q$, k1), 'logistics_plan_locked');
  PERFORM pg_temp.expect('K3 non accepté : plan encore modifiable (nouvelle version)', format($q$UPDATE marketplace_case_logistics_plans SET parcel_weight_grams=880 WHERE case_id=%L$q$, k3), 'ok');
  PERFORM pg_temp.check('K3 : la modification crée la version 2 et annule l''accord atelier',
    (SELECT version::text||'/'||coalesce(workshop_decision,'aucun') FROM marketplace_case_logistics_plans WHERE case_id=k3), '2/aucun');

  -- Offre refusée hors périmètre.
  PERFORM pg_temp.expect('K4 Fine Bindery : forfait refusé (pas d''ouvrage atelier importable)', format($q$INSERT INTO marketplace_commercial_proposals SELECT (jsonb_populate_record(NULL::marketplace_commercial_proposals, to_jsonb(p) || jsonb_build_object('id',gen_random_uuid(),'case_id',%L::uuid,'version',99,'status','proposed','accepted_at',NULL,'shipping_offer_kind','book_round_trip_fr','shipping_total_cents',1250,'shipping_other_cents',1250,'customer_vat_rate_bps',NULL,'tax_country',NULL,'customer_vat_amount_cents',NULL,'customer_total_ttc_cents',NULL,'tax_policy','MANUAL_TAX_REVIEW','tax_validation_source',NULL,'tax_validated_at',NULL,'tax_validated_by',NULL,'logistics_plan_version',NULL))).* FROM marketplace_commercial_proposals p WHERE p.case_id=%L LIMIT 1$q$, k4, k3), 'brand_unsupported');
  PERFORM pg_temp.expect('K2 sans forfait : aucune étiquette possible', format('SELECT marketplace_reserve_round_trip_label_manual(%L,%L,%L,false)', k2, 'outbound', admin), 'round_trip_offer_required');

  -- Verrou d'automatisation.
  PERFORM pg_temp.expect('Verrou fermé : achat automatique refusé', format('SELECT marketplace_reserve_round_trip_label(%L,%L,%L,%L)', k1, 'outbound', repeat('a',64), repeat('b',64)), 'automation_closed');
  PERFORM pg_temp.expect('Ouverture par un atelier refusée', format($q$SELECT marketplace_set_round_trip_automation(%L,true,'{}'::jsonb)$q$, member), 'admin_required');
  PERFORM pg_temp.expect('Ouverture sans preuves refusée', format($q$SELECT marketplace_set_round_trip_automation(%L,true,'{"provider_quote":"QA devis"}'::jsonb)$q$, admin), 'evidence_missing');
  evidence := '{"provider_quote":"QA recette seulement","coverage_terms":"QA recette seulement","tax_validation":"QA recette seulement","api_recette":"QA recette seulement","commercial_decision":"QA recette seulement"}';
  PERFORM pg_temp.expect('Ouverture justifiée (annulée en fin de recette)', format('SELECT marketplace_set_round_trip_automation(%L,true,%L::jsonb)', admin, evidence), 'ok');
  PERFORM pg_temp.expect('Verrou ouvert sans tarif revu : achat automatique toujours refusé', format('SELECT marketplace_reserve_round_trip_label(%L,%L,%L,%L)', k3, 'outbound', repeat('a',64), repeat('b',64)), 'round_trip_offer_required');
  PERFORM pg_temp.expect('Fermeture immédiate', format($q$SELECT marketplace_set_round_trip_automation(%L,false,'{}'::jsonb)$q$, admin), 'ok');

  -- Réservations manuelles : existant, annulation, remplacement explicite, déficit reconnu.
  res := marketplace_reserve_round_trip_label_manual(k1, 'outbound', admin, false);
  PERFORM pg_temp.check('Re-réservation après confirmation : étiquette existante, aucun nouvel achat', res->>'outcome', 'existing');
  PERFORM pg_temp.expect('Annulation sans référence refusée', format($q$SELECT marketplace_round_trip_label_transition(%L,'cancelled',NULL,'{"provider":"manual"}'::jsonb)$q$, ret_job), 'cancellation_reference_required');
  PERFORM pg_temp.expect('Annulation constatée avec référence', format($q$SELECT marketplace_round_trip_label_transition(%L,'cancelled',NULL,'{"provider":"manual","reference":"QA-ANNUL-1"}'::jsonb)$q$, ret_job), 'ok');
  PERFORM pg_temp.check('Annulation : aucun remboursement présumé', (SELECT coalesce(refunded_cost_ttc_cents::text,'null') FROM marketplace_round_trip_label_jobs WHERE id=ret_job), 'null');
  res := marketplace_reserve_round_trip_label_manual(k1, 'return', admin, false);
  PERFORM pg_temp.check('Remplacement non confirmé : refusé', res->>'outcome', 'replacement_confirmation_required');
  res := marketplace_reserve_round_trip_label_manual(k1, 'return', admin, true);
  new_ret := (res->>'id')::uuid;
  PERFORM pg_temp.check('Remplacement confirmé : nouvelle réservation', res->>'outcome', 'claim');
  PERFORM pg_temp.expect('Confirmation sans PDF privé déposé refusée', format($q$SELECT marketplace_round_trip_label_transition(%L,'label_confirmed',NULL,'{"provider":"manual","provider_label_id":"QA-R2","carrier":"QA","tracking":"QA-R2","method":"QA relais","charged_cost_ttc_cents":1200}'::jsonb)$q$, new_ret), 'label_object_missing');
  BEGIN
    INSERT INTO storage.objects(bucket_id,name) VALUES ('round-trip-labels-private', new_ret::text||'/label.pdf');
    PERFORM pg_temp.expect('Coût total > 15 € TTC sans reconnaissance du déficit : refusé', format($q$SELECT marketplace_round_trip_label_transition(%L,'label_confirmed',NULL,'{"provider":"manual","provider_label_id":"QA-R2","carrier":"QA","tracking":"QA-R2","method":"QA relais","charged_cost_ttc_cents":1200}'::jsonb)$q$, new_ret), 'deficit_acknowledgement_required');
    res := marketplace_round_trip_label_transition(new_ret,'label_confirmed',NULL,'{"provider":"manual","provider_label_id":"QA-R2","carrier":"QA","tracking":"QA-R2","method":"QA relais","charged_cost_ttc_cents":1200,"deficit_acknowledged":true}'::jsonb);
    PERFORM pg_temp.check('Déficit reconnu et consigné, prix client inchangé', (res->>'deficit_ttc_cents')||'/'||(SELECT customer_total_ttc_cents::text FROM marketplace_commercial_proposals WHERE case_id=k1 AND accepted_at IS NOT NULL), '169/13500');
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM pg_temp.check('Déficit (objet Storage simulé non insérable par ce rôle : couvert par PGlite)', 'skipped', 'skipped');
  END;

  -- Événements fournisseur : dédupliqués, sans détail privé.
  PERFORM pg_temp.expect('Suivi transporteur enregistré', format($q$SELECT marketplace_round_trip_label_transition(%L,'tracking_update','QA-EVT-1','{"provider":"manual","code":"delivered"}'::jsonb)$q$, out_job), 'ok');
  res := marketplace_round_trip_label_transition(out_job,'tracking_update','QA-EVT-1','{"provider":"manual","code":"delivered"}'::jsonb);
  PERFORM pg_temp.check('Même événement rejoué : dédupliqué', res->>'outcome', 'duplicate');
  PERFORM pg_temp.expect('Détail privé dans le journal : refusé', format($q$SELECT marketplace_round_trip_label_transition(%L,'operator_note',NULL,'{"address":"1 rue QA"}'::jsonb)$q$, out_job), 'private_details_refused');
  PERFORM pg_temp.expect('Frais réels constatés (cost_adjusted)', format($q$SELECT marketplace_round_trip_label_transition(%L,'cost_adjusted',NULL,'{"provider":"manual","charged_cost_ttc_cents":479}'::jsonb)$q$, out_job), 'ok');

  -- Accès atelier.
  PERFORM pg_temp.expect('Atelier non retenu : retour prêt refusé', format('SELECT marketplace_round_trip_return_ready(%L,%L,%L,400,300,200,50)', k1, draft_binder, draft_member), 'selected_workshop_required');
  PERFORM pg_temp.expect('Membre d''un autre atelier sur l''atelier retenu : refusé', format('SELECT marketplace_round_trip_return_ready(%L,%L,%L,400,300,200,50)', k1, binder, draft_member), 'active_membership_required');

  -- Privilèges navigateur.
  PERFORM pg_temp.check('Rôles navigateur : aucun accès aux plans, étiquettes, verrou',
    (has_table_privilege('authenticated','public.marketplace_case_logistics_plans','SELECT') OR has_table_privilege('anon','public.marketplace_round_trip_label_jobs','SELECT')
     OR has_table_privilege('authenticated','public.marketplace_round_trip_automation','SELECT')
     OR has_function_privilege('authenticated','public.marketplace_round_trip_return_ready(uuid,uuid,uuid,integer,integer,integer,integer)','EXECUTE'))::text, 'false');
END $$;
SELECT jsonb_build_object('n',n,'scenario',scenario,'expected',expected,'observed',left(observed,160),'pass',pass) FROM r ORDER BY n;
