ALTER TABLE public.build_runtime_rate ADD COLUMN IF NOT EXISTS session_id uuid;

CREATE INDEX IF NOT EXISTS build_runtime_rate_ip_created_idx
  ON public.build_runtime_rate (ip_hash, created_at DESC)
  WHERE session_id IS NULL;

CREATE INDEX IF NOT EXISTS build_runtime_rate_session_created_idx
  ON public.build_runtime_rate (session_id, created_at DESC)
  WHERE session_id IS NOT NULL;