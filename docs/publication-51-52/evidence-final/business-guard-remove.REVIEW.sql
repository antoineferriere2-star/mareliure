BEGIN;
SET LOCAL lock_timeout='5s';
DO $$ DECLARE t record; BEGIN
 IF session_user<>'postgres' OR current_user<>'postgres' THEN RAISE EXCEPTION 'wrong_operator'; END IF;
 FOR t IN SELECT c.relname FROM pg_trigger x JOIN pg_class c ON c.oid=x.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE x.tgname='publication_maintenance_v2' AND n.nspname='public' ORDER BY c.relname LOOP
  EXECUTE format('DROP TRIGGER publication_maintenance_v2 ON public.%I',t.relname);
 END LOOP;
END $$;
DROP FUNCTION publication_guard_v2.reject_mutation();
DROP SCHEMA publication_guard_v2;
COMMIT;
SELECT jsonb_build_object('state','maintenance-removed','remaining_guards',(SELECT count(*) FROM pg_trigger WHERE tgname='publication_maintenance_v2')) AS result;
