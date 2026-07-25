ALTER TABLE public.build_public_requests
  ADD COLUMN IF NOT EXISTS audit_result JSONB,
  ADD COLUMN IF NOT EXISTS audit_analyzed_at TIMESTAMPTZ;