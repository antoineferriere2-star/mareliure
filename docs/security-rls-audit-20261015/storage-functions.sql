BEGIN READ ONLY;
SET LOCAL statement_timeout='90s';
SELECT jsonb_build_object('at',now(),'read_only',current_setting('transaction_read_only'),
 'schema_privileges',(SELECT jsonb_object_agg(r,jsonb_build_object('usage',has_schema_privilege(r,'storage','USAGE'),'create',has_schema_privilege(r,'storage','CREATE'))) FROM unnest(ARRAY['anon','authenticated','service_role']) r),
 'tables',(SELECT jsonb_agg(jsonb_build_object('name',c.relname,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
 'grants',(SELECT jsonb_object_agg(r,jsonb_build_object('select',has_table_privilege(r,c.oid,'SELECT'),'insert',has_table_privilege(r,c.oid,'INSERT'),'update',has_table_privilege(r,c.oid,'UPDATE'),'delete',has_table_privilege(r,c.oid,'DELETE'),'truncate',has_table_privilege(r,c.oid,'TRUNCATE'))) FROM unnest(ARRAY['anon','authenticated','service_role']) r),
 'policies',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',policyname,'roles',roles,'command',cmd,'using',qual,'check',with_check)),'[]'::jsonb) FROM pg_policies p WHERE p.schemaname=n.nspname AND p.tablename=c.relname)) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='storage' AND c.relkind IN ('r','p','v')), 'functions',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,
 'identity_args',pg_get_function_identity_arguments(p.oid),'security_definer',p.prosecdef,
 'owner',pg_get_userbyid(p.proowner),'config',p.proconfig,'acl',p.proacl,
 'execute',(SELECT jsonb_object_agg(r,has_function_privilege(r,p.oid,'EXECUTE'))
 FROM unnest(ARRAY['anon','authenticated','service_role']) r),
 'definition',pg_get_functiondef(p.oid)) ORDER BY p.proname,pg_get_function_identity_arguments(p.oid))
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='storage' AND p.prokind='f'));
COMMIT;
