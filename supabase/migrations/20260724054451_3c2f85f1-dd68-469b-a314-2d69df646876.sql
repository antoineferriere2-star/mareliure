ALTER TABLE public.build_runtime_sessions
  ADD COLUMN session_secret_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE public.build_runtime_sessions
  ALTER COLUMN session_secret_hash DROP DEFAULT;
CREATE UNIQUE INDEX build_dossiers_session_id_uidx
  ON public.build_dossiers (session_id)
  WHERE session_id IS NOT NULL;