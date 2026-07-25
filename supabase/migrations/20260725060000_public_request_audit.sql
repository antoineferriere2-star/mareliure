-- AI Engine output for a submitted public request (free audit / private beta
-- form): admin-triggered analysis of the requester's own website, never
-- generated automatically at public submission time (same reasoning as
-- build_dossiers.ai_insights — the submission route is unauthenticated, an
-- automatic AI call there would be an abuse surface). Always additive.
ALTER TABLE public.build_public_requests
  ADD COLUMN audit_result JSONB,
  ADD COLUMN audit_analyzed_at TIMESTAMPTZ;
