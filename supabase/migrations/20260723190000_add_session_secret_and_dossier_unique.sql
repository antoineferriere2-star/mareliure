-- Session possession secret: only its hash is ever persisted. The raw secret
-- is generated server-side at start_session and returned to the caller once;
-- save_session/submit_session require session_id + session_secret together.
ALTER TABLE public.build_runtime_sessions
  ADD COLUMN session_secret_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE public.build_runtime_sessions
  ALTER COLUMN session_secret_hash DROP DEFAULT;

-- Idempotent submission: at most one dossier per runtime session.
CREATE UNIQUE INDEX build_dossiers_session_id_uidx
  ON public.build_dossiers (session_id)
  WHERE session_id IS NOT NULL;
