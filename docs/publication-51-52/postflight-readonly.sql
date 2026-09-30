-- To run only AFTER the separately authorized migrations. Not executed in preparation.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';
SELECT jsonb_build_object(
 'read_only',current_setting('transaction_read_only'),
 'versions',(SELECT jsonb_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations),
 'accepted_proposals_fingerprint',(SELECT md5(coalesce(string_agg(md5((to_jsonb(p)-ARRAY['payment_circuit','payment_provenance'])::text),'' ORDER BY id),'')) FROM public.marketplace_commercial_proposals p WHERE accepted_at IS NOT NULL),
 'accepted_quotes_fingerprint',(SELECT md5(coalesce(string_agg(md5((to_jsonb(q)-'payment_snapshot')::text),'' ORDER BY id),'')) FROM public.marketplace_binder_quotes q WHERE status IN ('accepted','invoiced')),
 'invoices_fingerprint',(SELECT md5(coalesce(string_agg(md5((to_jsonb(i)-'payment_snapshot')::text),'' ORDER BY id),'')) FROM public.marketplace_binder_invoices i),
 'missing_case_classifications',(SELECT count(*) FROM public.marketplace_cases c LEFT JOIN public.marketplace_case_payment_circuits p ON p.case_id=c.id WHERE p.case_id IS NULL),
 'incorrect_initial_classifications',(SELECT count(*) FROM public.marketplace_case_payment_circuits p WHERE p.circuit IS DISTINCT FROM CASE WHEN EXISTS(SELECT 1 FROM public.marketplace_commercial_proposals c WHERE c.case_id=p.case_id AND c.accepted_at IS NOT NULL) THEN 'legacy_resale' ELSE 'review_required' END),
 'changed_historical_contract_model',(SELECT count(*) FROM public.marketplace_commercial_proposals WHERE payment_circuit IS DISTINCT FROM 'legacy_resale' OR payment_provenance IS NOT NULL),
 'initial_agreements',(SELECT count(*) FROM public.marketplace_own_client_agreements),
 'initial_settlements',(SELECT count(*) FROM public.marketplace_external_settlements),
 'initial_logistics_events',(SELECT count(*) FROM public.marketplace_work_logistics_events),
 'initial_logistics_photos',(SELECT count(*) FROM public.marketplace_work_logistics_photos),
 'new_tables_permissions',(SELECT jsonb_agg(jsonb_build_object('name',r.relname,'rls',r.relrowsecurity,'anon_select',has_table_privilege('anon',r.oid,'SELECT'),'authenticated_select',has_table_privilege('authenticated',r.oid,'SELECT'),'service_select',has_table_privilege('service_role',r.oid,'SELECT'),'service_insert',has_table_privilege('service_role',r.oid,'INSERT'))) FROM pg_class r JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public' AND r.relname IN ('marketplace_case_payment_circuits','marketplace_own_client_agreements','marketplace_external_settlements','marketplace_work_logistics_events','marketplace_work_logistics_photos')),
 'payment_unique_index_valid',(SELECT i.indisvalid AND i.indisunique FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE c.relname='marketplace_payment_success_once'),
 'bucket',(SELECT jsonb_build_object('public',public,'limit',file_size_limit,'mime',allowed_mime_types) FROM storage.buckets WHERE id='work-logistics-private'),
 'storage_policy',(SELECT jsonb_build_object('permissive',permissive,'roles',roles,'cmd',cmd,'using',qual,'check',with_check) FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='logistics_private_server_only')
) AS postflight;
ROLLBACK;
