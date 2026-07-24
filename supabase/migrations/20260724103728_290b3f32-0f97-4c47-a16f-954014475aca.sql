ALTER TABLE public.build_dossiers
  ADD COLUMN ai_insights JSONB,
  ADD COLUMN ai_analyzed_at TIMESTAMPTZ;