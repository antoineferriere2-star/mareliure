CREATE TABLE public.build_public_site_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash TEXT NOT NULL,
  request_id TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'ok', 'error')),
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.build_public_site_analyses TO service_role;

ALTER TABLE public.build_public_site_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct access to build_public_site_analyses"
  ON public.build_public_site_analyses
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE UNIQUE INDEX build_public_site_analyses_dedupe_uidx
  ON public.build_public_site_analyses (ip_hash, request_id);

CREATE INDEX build_public_site_analyses_rate_idx
  ON public.build_public_site_analyses (ip_hash, created_at DESC);