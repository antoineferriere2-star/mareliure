-- qwf, exécuté dans BEGIN ... ROLLBACK : aucune donnée conservée. Données fictives QA-PR55-*.
CREATE TEMP TABLE r(n serial, scenario text, expected text, observed text, pass boolean);
CREATE FUNCTION pg_temp.expect(p_scenario text, p_sql text, p_expected text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  BEGIN EXECUTE p_sql; v := 'ok';
  EXCEPTION WHEN OTHERS THEN v := SQLERRM; END;
  INSERT INTO r(scenario,expected,observed,pass) VALUES(p_scenario,p_expected,v,
    CASE WHEN p_expected='ok' THEN v='ok' ELSE v LIKE '%'||p_expected||'%' END);
END $$;
CREATE FUNCTION pg_temp.check(p_scenario text, p_observed text, p_expected text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO r(scenario,expected,observed,pass) VALUES(p_scenario,p_expected,p_observed,p_observed IS NOT DISTINCT FROM p_expected) $$;

DO $$
DECLARE b uuid := 'd6c095c0-2cff-4ee9-9393-8891c5d8c03c'; b2 uuid := 'b9817e1b-4d63-4c4c-87a2-e82591232fcc';
  actor uuid; actor2 uuid; client uuid := gen_random_uuid(); qa text := 'QA-PR55-'||to_char(clock_timestamp(),'HH24MISS');
  q1 uuid := gen_random_uuid(); q2 uuid := gen_random_uuid(); q3 uuid := gen_random_uuid(); q4 uuid := gen_random_uuid(); q5 uuid := gen_random_uuid();
  qaudit uuid; inv uuid; rev text; c jsonb; issuer_full jsonb; issuer_none jsonb; old_profile jsonb;
BEGIN
  SELECT user_id INTO actor FROM marketplace_binder_members WHERE binder_id=b AND account_status='active' LIMIT 1;
  SELECT user_id INTO actor2 FROM marketplace_binder_members WHERE binder_id=b2 AND account_status='active' LIMIT 1;
  SELECT q.id INTO qaudit FROM marketplace_binder_quotes q WHERE quote_number='QA-AUDIT-1790849409185';
  UPDATE marketplace_binder_billing_profiles SET workshop_name='Atelier QA PR55' WHERE binder_id=b;
  SELECT jsonb_build_object('workshop',workshop_name,'legal',legal_name) INTO old_profile FROM marketplace_binder_billing_profiles WHERE binder_id=b;
  issuer_none := jsonb_build_object('workshopName',old_profile->>'workshop','legalName',old_profile->>'legal','country','FR');
  issuer_full := issuer_none || jsonb_build_object('siret','123 456 789 00012','siren','123456789','legalForm','EI','addressLine1','1 rue QA','postalCode','75001','city','Paris');
  INSERT INTO marketplace_binder_clients(id,binder_id,name,origin) VALUES(client,b,qa||' client fictif','mon_client');
  -- devis : q1 sans identifiant, q2 complet, q3 brouillon, q4 avec acompte, q5 pour la facture/avoir
  INSERT INTO marketplace_binder_quotes(id,binder_id,client_id,quote_number,status,issue_date,valid_until,client_name,currency,issuer,vat_regime,vat_mention,subtotal_cents,total_ht_cents,total_vat_cents,total_ttc_cents,deposit_cents)
  SELECT x.id,b,client,qa||'-'||x.k,x.s,current_date,current_date+30,'QA','EUR',x.i,'FRANCHISE','TVA non applicable',10000,10000,0,10000,x.d
  FROM (VALUES (q1,'1','sent',issuer_none,0),(q2,'2','sent',issuer_full,0),(q3,'3','draft',issuer_full,0),(q4,'4','sent',issuer_full,3000),(q5,'5','sent',issuer_full,0)) x(id,k,s,i,d);
  INSERT INTO marketplace_binder_quote_items(quote_id,binder_id,position,line_key,label,quantity,unit_price_cents,vat_rate_bps,total_ht_cents)
  SELECT id,b,1,'l1','Reliure QA',1,10000,0,10000 FROM unnest(ARRAY[q1,q2,q3,q4,q5]) id;
  PERFORM pg_temp.check('C2 nouveau devis classé external_v1',(SELECT string_agg(DISTINCT contract_epoch,',') FROM marketplace_binder_quotes WHERE id IN (q1,q2,q3,q4,q5)),'external_v1');
  PERFORM pg_temp.expect('C2 INSERT déclaré historique refusé',format($f$INSERT INTO marketplace_binder_quotes(id,binder_id,quote_number,status,issue_date,valid_until,client_name,currency,issuer,vat_regime,subtotal_cents,total_ht_cents,total_vat_cents,total_ttc_cents,contract_epoch) VALUES(gen_random_uuid(),%L,%L,'draft',current_date,current_date+30,'QA','EUR','{}','FRANCHISE',0,0,0,0,'pre_external_v1')$f$,b,qa||'-X'),'contract_epoch_immutable');
  -- C1
  c := marketplace_own_contract(q1,b,actor);
  PERFORM pg_temp.check('C1 devis sans identifiant : blocage expliqué',c->>'blocker','seller_identity_missing');
  PERFORM pg_temp.expect('C1 accord sans identifiant refusé',format('SELECT marketplace_accept_own_quote(%L,%L,%L,%L,%L)',q1,b,actor,'Accord e-mail QA PR55',c->>'revision'),'external_contract_unavailable');
  PERFORM pg_temp.expect('C1/C2 acceptation directe sans accord refusée',format($f$UPDATE marketplace_binder_quotes SET status='accepted' WHERE id=%L$f$,q1),'own_agreement_required');
  PERFORM pg_temp.expect('C1 accord avec identifiant',format('SELECT marketplace_accept_own_quote(%L,%L,%L,%L,%L)',q2,b,actor,'Accord e-mail QA PR55',marketplace_own_contract(q2,b,actor)->>'revision'),'ok');
  PERFORM pg_temp.expect('Refus après accord toujours interdit',format($f$UPDATE marketplace_binder_quotes SET status='refused' WHERE id=%L$f$,q2),'accepted_payment_terms_immutable');
  inv := marketplace_binder_create_invoice_draft(b,q2,jsonb_build_object('issue_date',current_date,'due_date',current_date+30,'operation_nature','services','issuer','{}'::jsonb));
  PERFORM marketplace_binder_update_invoice_draft(b,inv,jsonb_build_object('issue_date',current_date,'service_date',current_date,'due_date',current_date+30,'operation_nature','services','client_type','individual','client_name','QA','client_billing_address_line1','1 rue QA','client_billing_postal_code','75001','client_billing_city','Paris','client_billing_country','FR','vat_mention','TVA non applicable',
    'issuer',issuer_full || jsonb_build_object('siret','98765432100019','siren','987654321')));
  PERFORM pg_temp.expect('C1 facture sous un autre SIREN refusée',format('SELECT marketplace_binder_issue_invoice(%L,%L,%L)',b,inv,'[]'),'invoice_seller_changed_new_agreement_required');
  PERFORM marketplace_binder_update_invoice_draft(b,inv,jsonb_build_object('issue_date',current_date,'service_date',current_date,'due_date',current_date+30,'operation_nature','services','client_type','individual','client_name','QA','client_billing_address_line1','1 rue QA','client_billing_postal_code','75001','client_billing_city','Paris','client_billing_country','FR','vat_mention','TVA non applicable',
    'issuer',issuer_full || jsonb_build_object('siret','12345678900099')));
  PERFORM pg_temp.expect('C1 même SIREN, autre établissement : facture émise',format('SELECT marketplace_binder_issue_invoice(%L,%L,%L)',b,inv,'[]'),'ok');
  PERFORM pg_temp.expect('C1 règlement déclaré sur la facture émise',format('SELECT marketplace_record_external_settlement(%L,%L,%L,%L,%L,%s,%L)',gen_random_uuid(),inv,b,actor,'receipt',4000,'Virement QA PR55 1'),'ok');
  PERFORM pg_temp.expect('Droits : autre atelier refusé sur le suivi',format('SELECT marketplace_external_settlement_state(%L,%L,%L)',inv,b,actor2),'active_membership_required');
  PERFORM pg_temp.expect('Droits : autre atelier refusé sur l''attestation',format('SELECT marketplace_complete_own_agreement_identity(%L,%L,%L,%L)',qaudit,b,actor2,'Tentative croisée QA'),'active_membership_required');
  -- C1 accords incomplets existants (profil sans identifiant puis complété dans cette transaction)
  PERFORM pg_temp.check('C1 QA-AUDIT, profil sans identifiant',marketplace_own_agreement_identity(qaudit,b,actor)->>'state','profile_identifier_missing');
  UPDATE marketplace_binder_billing_profiles SET siret='12345678900012' WHERE binder_id=b;
  PERFORM pg_temp.check('C1 QA-AUDIT, nom figé différent : vendeur changé',marketplace_own_agreement_identity(qaudit,b,actor)->>'state','seller_changed');
  PERFORM pg_temp.expect('C1 QA-AUDIT, attestation refusée',format('SELECT marketplace_complete_own_agreement_identity(%L,%L,%L,%L)',qaudit,b,actor,'Même vendeur QA PR55'),'identity_completion_not_applicable:seller_changed');
  PERFORM pg_temp.check('C1 fixture sans nom (10074e0e) : vendeur non attestable',marketplace_own_agreement_identity('10074e0e-043f-4c76-886b-58e4b4726b48',b,actor)->>'state','seller_changed');
  -- C1 attestation réussie : accord historique simulé dans cette transaction annulée (même nom que le profil)
  INSERT INTO marketplace_own_client_agreements(quote_id,binder_id,actor_id,evidence,terms)
    VALUES(q5,b,actor,'Accord historique simulé QA',jsonb_build_object('version','own-external-v1','seller',issuer_none,'currency','EUR','total_ttc_cents',10000));
  UPDATE marketplace_binder_quotes SET status='accepted' WHERE id=q5;
  PERFORM pg_temp.check('C1 accord incomplet au même nom : attestation requise',marketplace_own_agreement_identity(q5,b,actor)->>'state','attestation_required');
  PERFORM pg_temp.expect('C1 attestation explicite',format('SELECT marketplace_complete_own_agreement_identity(%L,%L,%L,%L)',q5,b,actor,'Même atelier, SIRET ajouté au profil'),'ok');
  PERFORM pg_temp.expect('C1 attestation immuable',format($f$UPDATE marketplace_own_agreement_identity_completions SET attestation='modifiée' WHERE quote_id=%L$f$,q5),'settlement_history_immutable');
  inv := marketplace_binder_create_invoice_draft(b,q5,jsonb_build_object('issue_date',current_date,'due_date',current_date+30,'operation_nature','services','issuer','{}'::jsonb));
  PERFORM marketplace_binder_update_invoice_draft(b,inv,jsonb_build_object('issue_date',current_date,'service_date',current_date,'due_date',current_date+30,'operation_nature','services','client_type','individual','client_name','QA','client_billing_address_line1','1 rue QA','client_billing_postal_code','75001','client_billing_city','Paris','client_billing_country','FR','vat_mention','TVA non applicable','issuer',issuer_full));
  PERFORM pg_temp.expect('C1 facture émise après attestation',format('SELECT marketplace_binder_issue_invoice(%L,%L,%L)',b,inv,'[]'),'ok');
  PERFORM pg_temp.expect('C3 avoir complet',format('SELECT marketplace_binder_create_full_credit_note(%L,%L,current_date,%L)',b,inv,'Annulation QA PR55'),'ok');
  PERFORM pg_temp.check('C3 avoir ne change ni la facture ni le règlement',(SELECT status||'/'||payment_status FROM marketplace_binder_invoices WHERE id=inv),'issued/unpaid');
  PERFORM pg_temp.check('C3 avoir couvre tout le TTC',(SELECT (sum(n.total_ttc_cents)>=max(i.total_ttc_cents))::text FROM marketplace_binder_credit_notes n JOIN marketplace_binder_invoices i ON i.id=n.invoice_id WHERE n.invoice_id=inv),'true');
  -- C2
  PERFORM pg_temp.check('C2 brouillon postérieur : envoyer d''abord',marketplace_own_contract(q3,b,actor)->>'blocker','send_first');
  PERFORM pg_temp.expect('C2 brouillon postérieur → accepté sans accord refusé',format($f$UPDATE marketplace_binder_quotes SET status='accepted' WHERE id=%L$f$,q3),'own_agreement_required');
  PERFORM pg_temp.check('C2 devis reclassé avec acompte : hors circuit, accord non exigé',marketplace_own_contract('26870957-2b13-47f7-9d2e-393d3b9b515a',b,actor)->>'agreementRequired','false');
  PERFORM pg_temp.expect('C2 devis avec acompte : acceptation préservée',format($f$UPDATE marketplace_binder_quotes SET status='accepted' WHERE id=%L$f$,q4),'ok');
  inv := marketplace_binder_create_invoice_draft(b,q4,jsonb_build_object('issue_date',current_date,'due_date',current_date+30,'operation_nature','services','issuer','{}'::jsonb));
  PERFORM pg_temp.check('C2 facture avec acompte : raison affichée',marketplace_external_settlement_state(inv,b,actor)->>'reason','not_issued');
  PERFORM pg_temp.check('C2 aucun accord fabriqué pour l''acompte',(SELECT count(*)::text FROM marketplace_own_client_agreements WHERE quote_id=q4),'0');
END $$;
SELECT jsonb_build_object('n',n,'pass',pass,'scenario',scenario,'expected',expected,'observed',left(observed,90)) FROM r ORDER BY n;
