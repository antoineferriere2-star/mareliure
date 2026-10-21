BEGIN READ ONLY;
SET LOCAL statement_timeout='90s';
SELECT jsonb_build_object('schema_privileges',(SELECT jsonb_object_agg(r,jsonb_build_object('public_create',has_schema_privilege(r,'public','CREATE'),'public_usage',has_schema_privilege(r,'public','USAGE'),'database_temp',has_database_privilege(r,current_database(),'TEMP'))) FROM unnest(ARRAY['anon','authenticated','service_role']) r));
DO $audit$
DECLARE r text; t record; n bigint; code text; output jsonb:='[]';
BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
  FOR t IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p') AND ((n.nspname='public' AND c.relname LIKE 'marketplace\_%' ESCAPE '\') OR (n.nspname='storage' AND c.relname IN ('objects','buckets'))) ORDER BY 1,2 LOOP
   n:=NULL; code:='00000';
   EXECUTE format('SET LOCAL ROLE %I',r);
   BEGIN EXECUTE format('SELECT count(*) FROM %I.%I',t.nspname,t.relname) INTO n;
   EXCEPTION WHEN insufficient_privilege THEN code:=SQLSTATE;
   END;
   RESET ROLE;
   output:=output||jsonb_build_array(jsonb_build_object('role',r,'table',t.nspname||'.'||t.relname,'visible_rows',n,'sqlstate',code));
  END LOOP;
 END LOOP;
 RAISE NOTICE 'AUDIT_ROLE_PROBES %',output;
END $audit$;
ROLLBACK;
