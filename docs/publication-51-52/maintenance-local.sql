-- Local design rehearsal only. Not an authorized production script.
-- Apply inside a transaction; rollback removes the rehearsal guard.
CREATE SCHEMA publication_guard;
REVOKE ALL ON SCHEMA publication_guard FROM PUBLIC;
CREATE FUNCTION publication_guard.reject_mutation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  -- session_user is unaffected by SECURITY DEFINER and cannot be forged with SET ROLE.
  -- The real hosted CLI session identity must be separately verified before adaptation.
  IF session_user NOT IN ('postgres','supabase_admin') THEN
    RAISE EXCEPTION 'publication_maintenance' USING ERRCODE='55000';
  END IF;
  RETURN NULL;
END $$;
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname
 LOOP
  EXECUTE format('CREATE TRIGGER publication_maintenance BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION publication_guard.reject_mutation()',t.relname);
 END LOOP;
END $$;
-- Does NOT freeze auth/storage managed services or prevent privileged manual DDL.
-- Add guards to newly created business tables before COMMIT in the eventual protocol.
