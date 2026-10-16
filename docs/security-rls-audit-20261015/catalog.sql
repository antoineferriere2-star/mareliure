BEGIN READ ONLY;
SET LOCAL statement_timeout='90s';
SELECT jsonb_build_object(
 'at',now(),'database',current_database(),'read_only',current_setting('transaction_read_only'),
 'migration_count',(SELECT count(*) FROM supabase_migrations.schema_migrations),
 'migration_latest',(SELECT max(version) FROM supabase_migrations.schema_migrations),
 'roles',(SELECT jsonb_agg(jsonb_build_object('name',rolname,'bypass_rls',rolbypassrls,'superuser',rolsuper)) FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role')),
 'tables',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'owner',pg_get_userbyid(c.relowner),
   'grants',(SELECT jsonb_object_agg(r,jsonb_build_object('select',has_table_privilege(r,c.oid,'SELECT'),'insert',has_table_privilege(r,c.oid,'INSERT'),'update',has_table_privilege(r,c.oid,'UPDATE'),'delete',has_table_privilege(r,c.oid,'DELETE'),'truncate',has_table_privilege(r,c.oid,'TRUNCATE'),'references',has_table_privilege(r,c.oid,'REFERENCES'),'trigger',has_table_privilege(r,c.oid,'TRIGGER'))) FROM unnest(ARRAY['anon','authenticated','service_role']) r),
   'column_acl',(SELECT jsonb_agg(jsonb_build_object('column',attname,'acl',attacl)) FROM pg_attribute WHERE attrelid=c.oid AND attnum>0 AND NOT attisdropped AND attacl IS NOT NULL),
   'policies',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',policyname,'permissive',permissive,'roles',roles,'command',cmd,'using',qual,'check',with_check) ORDER BY policyname),'[]'::jsonb) FROM pg_policies p WHERE p.schemaname=n.nspname AND p.tablename=c.relname)) ORDER BY n.nspname,c.relname)
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p','v') AND ((n.nspname='public' AND c.relname LIKE 'marketplace\_%' ESCAPE '\') OR (n.nspname='storage' AND c.relname IN ('objects','buckets')))),
 'buckets',(SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'public',public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types) ORDER BY id) FROM storage.buckets),
 'functions',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'identity_args',pg_get_function_identity_arguments(p.oid),'security_definer',p.prosecdef,'owner',pg_get_userbyid(p.proowner),'config',p.proconfig,'acl',p.proacl,
   'execute',(SELECT jsonb_object_agg(r,has_function_privilege(r,p.oid,'EXECUTE')) FROM unnest(ARRAY['anon','authenticated','service_role']) r),'definition',pg_get_functiondef(p.oid)) ORDER BY p.proname,pg_get_function_identity_arguments(p.oid))
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' AND (p.proname LIKE 'marketplace\_%' ESCAPE '\' OR p.prosecdef OR p.prosrc ILIKE '%marketplace_%')),
 'default_acls',(SELECT jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(defaclrole),'schema',n.nspname,'kind',defaclobjtype,'acl',defaclacl)) FROM pg_default_acl a LEFT JOIN pg_namespace n ON n.oid=defaclnamespace)
);
COMMIT;
