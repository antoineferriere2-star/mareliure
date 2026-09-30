// Fingerprints contain counts/digests only. No row content is emitted.
export function identifiers(tables) {
 if(!Array.isArray(tables)||!tables.length||new Set(tables).size!==tables.length||tables.some(n=>!/^marketplace_[a-z0-9_]+$/.test(n)&&n!=='user_roles'))throw Error('Unsafe table inventory');
 return [...tables].sort();
}
export function fingerprintQuery(tables) {
 const names=identifiers(tables);
 const data=names.map(n=>`SELECT '${n}' AS name,count(*)::integer AS rows,md5(coalesce(string_agg(md5((to_jsonb(t) ${n==='marketplace_binder_quotes'||n==='marketplace_binder_invoices'?"- 'payment_snapshot'":n==='marketplace_commercial_proposals'?"- ARRAY['payment_circuit','payment_provenance']":""})::text),'' ORDER BY md5((to_jsonb(t) ${n==='marketplace_binder_quotes'||n==='marketplace_binder_invoices'?"- 'payment_snapshot'":n==='marketplace_commercial_proposals'?"- ARRAY['payment_circuit','payment_provenance']":""})::text)),'')) AS digest FROM public.${n} t`).join(' UNION ALL ');
 return `SELECT jsonb_build_object(
 'history_count',(SELECT count(*) FROM supabase_migrations.schema_migrations),
 'history_hash',(SELECT md5(coalesce(jsonb_agg(to_jsonb(m) ORDER BY version)::text,'[]')) FROM supabase_migrations.schema_migrations m),
 'schema_hash',md5(jsonb_build_object(
  'relations',(SELECT jsonb_agg(jsonb_build_object('name',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl,'rls',c.relrowsecurity,'force',c.relforcerowsecurity) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S')),
  'columns',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'identity',a.attidentity,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY c.relname,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m') AND a.attnum>0 AND NOT a.attisdropped),
  'constraints',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',x.conname,'def',pg_get_constraintdef(x.oid)) ORDER BY c.relname,x.conname) FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'),
  'indexes',(SELECT jsonb_agg(jsonb_build_object('table',tablename,'name',indexname,'def',indexdef) ORDER BY tablename,indexname) FROM pg_indexes WHERE schemaname='public'),
  'triggers',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,'enabled',t.tgenabled,'def',pg_get_triggerdef(t.oid)) ORDER BY c.relname,t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgname NOT LIKE 'publication_maintenance%'),
  'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY schemaname,tablename,policyname) FROM pg_policies p WHERE schemaname IN ('public','storage')),
  'functions',(SELECT jsonb_agg(jsonb_build_object('name',p.proname,'args',pg_get_function_identity_arguments(p.oid),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl,'definition',md5(pg_get_functiondef(p.oid))) ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f')
 )::text),
 'business_hash',(SELECT md5(jsonb_agg(to_jsonb(d) ORDER BY name)::text) FROM (${data}) d),
 'business_tables',(SELECT jsonb_agg(to_jsonb(d) ORDER BY name) FROM (${data}) d),
 'managed',jsonb_build_object(
  'auth_users',(SELECT count(*) FROM auth.users),
  'auth_users_hash',(SELECT md5(coalesce(string_agg(md5(to_jsonb(a)::text),'' ORDER BY id),'')) FROM auth.users a),
  'auth_sessions',(SELECT count(*) FROM auth.sessions),
  'storage_objects',(SELECT count(*) FROM storage.objects),
  'storage_objects_hash',(SELECT md5(coalesce(string_agg(md5(to_jsonb(s)::text),'' ORDER BY id),'')) FROM storage.objects s),
  'existing_buckets_hash',(SELECT md5(coalesce(string_agg(md5(to_jsonb(b)::text),'' ORDER BY id),'')) FROM storage.buckets b WHERE id<>'work-logistics-private')
 )) AS fingerprint`;
}
export function validateBaseline(baseline) {
 for(const key of ['schema_hash','history_hash','business_hash'])if(!/^[a-f0-9]{32}$/.test(baseline?.[key]))throw Error('Invalid fingerprint: '+key);
 if(baseline.history_count!==91)throw Error('Expected 91 baseline migrations');
 identifiers(baseline.business_tables?.map(t=>t.name));
}
export function comparisonSQL(baseline) {
 validateBaseline(baseline);
 return `DO $$ BEGIN
 IF (SELECT data->>'schema_hash' FROM publication_live_fingerprint)<>'${baseline.schema_hash}' THEN RAISE EXCEPTION 'schema_drift'; END IF;
 IF (SELECT data->>'history_hash' FROM publication_live_fingerprint)<>'${baseline.history_hash}' THEN RAISE EXCEPTION 'history_drift'; END IF;
 IF (SELECT data->>'business_hash' FROM publication_live_fingerprint)<>'${baseline.business_hash}' THEN RAISE EXCEPTION 'business_drift'; END IF;
 END $$;`;
}
