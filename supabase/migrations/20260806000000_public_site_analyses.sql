-- Anonymous website analyses run from /free-inquiry-audit.
--
-- The page lets a visitor paste their URL and see what the analysis agent
-- finds, before creating any account. That means an unauthenticated request
-- can trigger a real LLM call, so this table serves two purposes at once:
-- it is the rate-limit ledger (count rows per ip_hash over the last hour)
-- and the record of what was analysed, for volume and cost instrumentation.
--
-- The visitor's IP is stored hashed, never in clear, exactly as
-- build_runtime_rate and build_public_request_rate already do. A raw IP is
-- personal data we have no use for: rate limiting only needs to recognise
-- the same caller, which a salted hash does just as well.
--
-- No workspace_id and no user_id: at analysis time the visitor has no
-- account. Nothing here is ever linked back to one afterwards.

CREATE TABLE public.build_public_site_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash TEXT NOT NULL,
  -- Client-generated, so a retried or double-submitted request resolves to
  -- the same row instead of paying for a second analysis.
  request_id TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'ok', 'error')),
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.build_public_site_analyses TO service_role;

ALTER TABLE public.build_public_site_analyses ENABLE ROW LEVEL SECURITY;

-- Deny-all, like every other table in this schema: reached only through the
-- service-role client in /api/public/analyze-site, never directly.
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
