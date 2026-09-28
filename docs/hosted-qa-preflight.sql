-- READ ONLY. Run only after the target has been positively identified as test.
-- Production refs excluded: hljxohondjvrkzqicexl, qwfhebtxeubfmvvdsqdt.
-- The database name alone does NOT establish the Supabase project identity.
BEGIN READ ONLY;
SELECT current_database() AS database_name, current_user AS database_role,
       current_setting('transaction_read_only') AS read_only;
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class JOIN pg_namespace n ON n.oid=relnamespace
WHERE n.nspname='public' AND relname IN (
  'marketplace_binder_members','marketplace_binder_works',
  'marketplace_case_payment_circuits','marketplace_own_client_agreements',
  'marketplace_external_settlements','marketplace_work_logistics_events',
  'marketplace_work_logistics_photos');
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema='public' AND (
  (table_name='marketplace_commercial_proposals' AND column_name IN ('payment_circuit','payment_provenance')) OR
  (table_name IN ('marketplace_binder_quotes','marketplace_binder_invoices') AND column_name='payment_snapshot'));
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE (schemaname='storage' AND tablename='objects')
  OR (schemaname='public' AND tablename IN ('marketplace_case_payment_circuits',
    'marketplace_own_client_agreements','marketplace_external_settlements',
    'marketplace_work_logistics_events','marketplace_work_logistics_photos'));
SELECT table_name,grantee,privilege_type FROM information_schema.table_privileges
WHERE table_schema='public' AND table_name IN ('marketplace_case_payment_circuits',
  'marketplace_own_client_agreements','marketplace_external_settlements',
  'marketplace_work_logistics_events','marketplace_work_logistics_photos')
ORDER BY table_name,grantee,privilege_type;
SELECT routine_name,grantee,privilege_type FROM information_schema.routine_privileges
WHERE routine_schema='public' AND routine_name IN ('marketplace_work_logistics',
  'marketplace_accept_own_quote','marketplace_record_external_settlement',
  'marketplace_external_settlement_state','marketplace_set_case_payment_circuit');
SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets
WHERE id='work-logistics-private';
-- Count only: no customer data or payment identifiers returned.
SELECT count(*) AS duplicate_payment_intents FROM (
  SELECT metadata->>'payment_intent_id' FROM public.marketplace_events
  WHERE event_type='CUSTOMER_PAYMENT_SUCCEEDED' AND metadata->>'payment_intent_id' IS NOT NULL
  GROUP BY 1 HAVING count(*)>1
) AS duplicates;
ROLLBACK;
