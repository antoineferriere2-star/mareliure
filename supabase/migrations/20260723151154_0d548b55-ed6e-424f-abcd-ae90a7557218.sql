-- Enum for request types
DO $$ BEGIN
  CREATE TYPE public.build_public_request_type AS ENUM ('audit', 'private_beta');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Main table
CREATE TABLE public.build_public_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type public.build_public_request_type NOT NULL,
  source_path TEXT NOT NULL,
  payload JSONB NOT NULL,
  consent BOOLEAN NOT NULL DEFAULT false,
  user_agent TEXT,
  ip_hash TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No grants to anon or authenticated: service_role only
GRANT ALL ON public.build_public_requests TO service_role;

ALTER TABLE public.build_public_requests ENABLE ROW LEVEL SECURITY;

-- Explicit deny for anon and authenticated (RLS default denies too, but keep it explicit for clarity).
CREATE POLICY "No direct access to build_public_requests"
  ON public.build_public_requests
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE INDEX build_public_requests_created_at_idx ON public.build_public_requests (created_at DESC);
CREATE INDEX build_public_requests_type_idx ON public.build_public_requests (request_type);

-- Rate-limit helper table (ip_hash + rolling window)
CREATE TABLE public.build_public_request_rate (
  ip_hash TEXT NOT NULL,
  request_type public.build_public_request_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.build_public_request_rate TO service_role;

ALTER TABLE public.build_public_request_rate ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct access to build_public_request_rate"
  ON public.build_public_request_rate
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE INDEX build_public_request_rate_lookup_idx
  ON public.build_public_request_rate (ip_hash, request_type, created_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.build_public_requests_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER build_public_requests_set_updated_at
  BEFORE UPDATE ON public.build_public_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.build_public_requests_touch_updated_at();
