ALTER TABLE public.build_workspaces
  ADD COLUMN max_active_missions integer NOT NULL DEFAULT 1,
  ADD COLUMN monthly_brief_quota integer NOT NULL DEFAULT 50;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_build_workspaces_updated_at'
      AND tgrelid = 'public.build_workspaces'::regclass
  ) THEN
    CREATE TRIGGER update_build_workspaces_updated_at
      BEFORE UPDATE ON public.build_workspaces
      FOR EACH ROW
      EXECUTE FUNCTION public.build_touch_updated_at();
  END IF;
END
$$;