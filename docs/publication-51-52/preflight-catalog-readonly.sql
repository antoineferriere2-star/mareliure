-- Production preparation only. No application function, DDL or DML is called.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '3s';
SELECT jsonb_build_object(
 'database', current_database(), 'role', current_user,
 'read_only', current_setting('transaction_read_only'), 'server', version(),
 'migrations', (SELECT jsonb_agg(jsonb_build_object('version',version,'name',name,'statements_md5',md5(statements::text)) ORDER BY version) FROM supabase_migrations.schema_migrations),
 'columns', (SELECT jsonb_agg(jsonb_build_object('schema',table_schema,'table',table_name,'column',column_name,'type',udt_name,'nullable',is_nullable,'default',column_default) ORDER BY table_schema,table_name,ordinal_position)
   FROM information_schema.columns WHERE (table_schema='public' AND (table_name LIKE 'marketplace_%' OR table_name='user_roles')) OR (table_schema='storage' AND table_name IN ('buckets','objects'))),
 'constraints', (SELECT jsonb_agg(jsonb_build_object('table',r.relname,'name',c.conname,'definition',pg_get_constraintdef(c.oid)) ORDER BY r.relname,c.conname) FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public' AND r.relname LIKE 'marketplace_%'),
 'triggers', (SELECT jsonb_agg(jsonb_build_object('table',r.relname,'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) ORDER BY r.relname,t.tgname) FROM pg_trigger t JOIN pg_class r ON r.oid=t.tgrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public' AND r.relname LIKE 'marketplace_%' AND NOT t.tgisinternal),
 'functions', (SELECT jsonb_agg(jsonb_build_object('name',p.proname,'args',pg_get_function_identity_arguments(p.oid),'definition_md5',md5(pg_get_functiondef(p.oid))) ORDER BY p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'marketplace_%' AND p.prokind='f'),
 'indexes', (SELECT jsonb_agg(jsonb_build_object('table',tablename,'name',indexname,'definition',indexdef) ORDER BY tablename,indexname) FROM pg_indexes WHERE schemaname='public' AND tablename LIKE 'marketplace_%'),
 'logistics_bucket_exists', EXISTS(SELECT 1 FROM storage.buckets WHERE id='work-logistics-private'),
 'storage_policy_names', (SELECT jsonb_agg(jsonb_build_object('name',policyname,'permissive',permissive,'roles',roles,'cmd',cmd)) FROM pg_policies WHERE schemaname='storage' AND tablename='objects')
) AS preflight;
ROLLBACK;
