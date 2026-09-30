BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE SCHEMA publication_guard_v2;
REVOKE ALL ON SCHEMA publication_guard_v2 FROM PUBLIC;
CREATE FUNCTION publication_guard_v2.reject_mutation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF session_user <> 'postgres' THEN RAISE EXCEPTION 'publication_maintenance' USING ERRCODE='55000'; END IF;
 RETURN NULL;
END $$;
DO $$ DECLARE t record; BEGIN
 IF session_user<>'postgres' OR current_user<>'postgres' THEN RAISE EXCEPTION 'wrong_operator'; END IF;
 FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND (c.relname LIKE 'marketplace_%' OR c.relname='user_roles') ORDER BY c.relname LOOP
  EXECUTE format('CREATE TRIGGER publication_maintenance_v2 BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION publication_guard_v2.reject_mutation()',t.relname);
 END LOOP;
END $$;
COMMIT;
SELECT jsonb_build_object('state','maintenance-active','guarded_tables',(SELECT count(*) FROM pg_trigger WHERE tgname='publication_maintenance_v2'),'operator',session_user) AS result;
