-- Prepared 19 October 2026 from the independent security audit (#132).
-- Production application requires a separate explicit instruction from the owner.
-- Existing build_* and Storage ACLs/policies are outside this change.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $hardening$
DECLARE
  requested constant jsonb := $manifest$[
    {"name":"marketplace_binder_applications","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_binder_billing_profiles","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_binder_clients","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_binder_commercial_terms","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_binder_credit_note_items","used":["SELECT","INSERT"]},
    {"name":"marketplace_binder_credit_notes","used":["SELECT","INSERT"]},
    {"name":"marketplace_binder_document_counters","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_binder_invitations","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_binder_invoice_items","used":["SELECT","INSERT"]},
    {"name":"marketplace_binder_invoices","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_binder_members","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_binder_operation_photos","used":["SELECT","INSERT","UPDATE","DELETE"]},
    {"name":"marketplace_binder_portfolio","used":["SELECT","INSERT","UPDATE","DELETE"]},
    {"name":"marketplace_binder_price_preferences","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_binder_quote_item_photos","used":["SELECT","INSERT","DELETE"]},
    {"name":"marketplace_binder_quote_items","used":["SELECT","INSERT","DELETE"]},
    {"name":"marketplace_binder_quotes","used":["SELECT","INSERT","UPDATE","DELETE"]},
    {"name":"marketplace_binder_rates","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_binder_service_categories","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_binder_services","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_binder_skills","used":["SELECT","INSERT","DELETE"]},
    {"name":"marketplace_binder_subscriptions","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_binder_work_counters","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_binder_work_photos","used":[]},
    {"name":"marketplace_binder_works","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_binders","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_case_logistics_plans","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_case_matches","used":["SELECT","INSERT","UPDATE","DELETE"]},
    {"name":"marketplace_case_payment_circuits","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_cases","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_commercial_proposal_payments","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_commercial_proposals","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_conversation_reads","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_decisions","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_events","used":["SELECT","INSERT"]},
    {"name":"marketplace_external_settlements","used":["SELECT","INSERT"]},
    {"name":"marketplace_intake_missions","used":["SELECT"]},
    {"name":"marketplace_messages","used":["SELECT","INSERT"]},
    {"name":"marketplace_oppe_credit_notes","used":["SELECT","INSERT"]},
    {"name":"marketplace_oppe_disputes","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_oppe_document_counters","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_oppe_invoice_items","used":["SELECT","INSERT"]},
    {"name":"marketplace_oppe_invoices","used":["SELECT","INSERT"]},
    {"name":"marketplace_oppe_order_assignments","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_oppe_orders","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_oppe_refunds","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_oppe_supplier_invoices","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_oppe_supplier_payments","used":["SELECT","INSERT"]},
    {"name":"marketplace_own_agreement_identity_completions","used":["SELECT","INSERT"]},
    {"name":"marketplace_own_client_agreements","used":["SELECT","INSERT"]},
    {"name":"marketplace_pricebook","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_proposal_acceptances","used":["SELECT","INSERT"]},
    {"name":"marketplace_proposal_billing_details","used":["SELECT","INSERT"]},
    {"name":"marketplace_quotes","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_reference_default_prices","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_reference_price_operation_links","used":[]},
    {"name":"marketplace_round_trip_automation","used":["SELECT","UPDATE"]},
    {"name":"marketplace_round_trip_automation_changes","used":["SELECT","INSERT"]},
    {"name":"marketplace_round_trip_label_events","used":["SELECT","INSERT"]},
    {"name":"marketplace_round_trip_label_jobs","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_round_trip_rate_approvals","used":["SELECT","INSERT"]},
    {"name":"marketplace_stripe_webhook_events","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_work_items","used":[]},
    {"name":"marketplace_work_logistics_events","used":["SELECT","INSERT"]},
    {"name":"marketplace_work_logistics_labels","used":["SELECT","INSERT"]},
    {"name":"marketplace_work_logistics_photos","used":["SELECT","INSERT"]},
    {"name":"marketplace_workshop_billing_documents","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_workshop_checkout_attempts","used":["SELECT","INSERT"]},
    {"name":"marketplace_workshop_connect_consent_history","used":["SELECT","INSERT"]},
    {"name":"marketplace_workshop_connect_consents","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_workshop_fee_counters","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_workshop_fee_documents","used":["SELECT","INSERT"]},
    {"name":"marketplace_workshop_notices","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_workshop_offer_settings","used":["SELECT"]},
    {"name":"marketplace_workshop_online_disputes","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_workshop_online_payments","used":["SELECT","INSERT","UPDATE"]},
    {"name":"marketplace_workshop_online_refund_attempts","used":["SELECT","INSERT"]},
    {"name":"marketplace_workshop_online_refunds","used":["SELECT","INSERT","UPDATE"]}
  ]$manifest$::jsonb;
  item record;
  actual text[];
  expected text[];
  column_names text;
  operation text;
  routine record;
  service_had_execute boolean;
BEGIN
  SELECT array_agg(c.relname ORDER BY c.relname) INTO actual
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname LIKE 'marketplace\_%' ESCAPE '\';
  SELECT array_agg(x.name ORDER BY x.name) INTO expected
  FROM jsonb_to_recordset(requested) x(name text, used text[]);
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'marketplace_acl_inventory_changed: reread the usage inventory before applying';
  END IF;
  FOR item IN SELECT * FROM jsonb_to_recordset(requested) x(name text, used text[]) LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated',item.name);
    SELECT string_agg(quote_ident(a.attname),', ' ORDER BY a.attnum) INTO column_names
    FROM pg_attribute a WHERE a.attrelid=format('public.%I',item.name)::regclass AND a.attnum>0 AND NOT a.attisdropped;
    EXECUTE format('REVOKE ALL PRIVILEGES (%s) ON TABLE public.%I FROM PUBLIC, anon, authenticated',column_names,item.name);
    EXECUTE format('REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.%I FROM service_role',item.name);
    IF current_setting('server_version_num')::integer>=170000 THEN
      EXECUTE format('REVOKE MAINTAIN ON TABLE public.%I FROM service_role',item.name);
    END IF;
    FOREACH operation IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
      IF NOT operation=ANY(item.used) THEN
        EXECUTE format('REVOKE %s ON TABLE public.%I FROM service_role',operation,item.name);
        IF operation<>'DELETE' THEN
          EXECUTE format('REVOKE %s (%s) ON TABLE public.%I FROM service_role',operation,column_names,item.name);
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  -- Triggers are invoked through their existing table triggers, not public RPCs.
  FOR routine IN
    SELECT p.oid,p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname LIKE 'marketplace\_%' ESCAPE '\' AND p.prorettype='pg_catalog.trigger'::regtype
  LOOP
    service_had_execute:=has_function_privilege('service_role',routine.oid,'EXECUTE');
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',routine.signature);
    IF service_had_execute THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',routine.signature); END IF;
  END LOOP;
END;
$hardening$;

-- Four publicly executable trigger functions without an explicit search_path.
ALTER FUNCTION public.marketplace_cases_forbid_brand_change() SET search_path TO public, pg_temp;
ALTER FUNCTION public.marketplace_commercial_proposals_forbid_change_after_acceptance() SET search_path TO public, pg_temp;
ALTER FUNCTION public.marketplace_logistics_immutable() SET search_path TO public, pg_temp;
ALTER FUNCTION public.marketplace_settlement_immutable() SET search_path TO public, pg_temp;

-- PostgreSQL default privileges cannot be filtered by a future table-name prefix.
-- This affects future public tables created by postgres, including future build_* tables:
-- migrations needing direct browser access must grant it explicitly. Existing build_* ACLs remain unchanged.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM service_role;
DO $defaults$
BEGIN
  IF current_setting('server_version_num')::integer>=170000 THEN
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE MAINTAIN ON TABLES FROM service_role';
  END IF;
END;
$defaults$;

NOTIFY pgrst, 'reload schema';
COMMIT;
