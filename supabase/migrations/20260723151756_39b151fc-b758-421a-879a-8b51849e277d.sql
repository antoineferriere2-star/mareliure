-- Shared touch trigger
CREATE OR REPLACE FUNCTION public.build_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- build_missions
CREATE TABLE public.build_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'active' | 'archived'
  objective TEXT,
  audience JSONB NOT NULL DEFAULT '{}'::jsonb,
  project JSONB NOT NULL DEFAULT '{}'::jsonb,
  proposal JSONB,
  playbook_id UUID,
  playbook_name TEXT,
  public_token TEXT,
  public_token_revoked_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.build_missions TO service_role;
ALTER TABLE public.build_missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access to build_missions"
  ON public.build_missions FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE UNIQUE INDEX build_missions_public_token_uidx
  ON public.build_missions(public_token) WHERE public_token IS NOT NULL;
CREATE INDEX build_missions_status_idx ON public.build_missions(status);
CREATE INDEX build_missions_public_token_active_idx
  ON public.build_missions(public_token, status)
  WHERE public_token IS NOT NULL AND public_token_revoked_at IS NULL;

CREATE TRIGGER build_missions_touch
  BEFORE UPDATE ON public.build_missions
  FOR EACH ROW EXECUTE FUNCTION public.build_touch_updated_at();

-- build_runtime_sessions
CREATE TABLE public.build_runtime_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.build_missions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress' | 'submitted' | 'abandoned'
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  visitor_hash TEXT,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ
);
GRANT ALL ON public.build_runtime_sessions TO service_role;
ALTER TABLE public.build_runtime_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access to build_runtime_sessions"
  ON public.build_runtime_sessions FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE INDEX build_runtime_sessions_mission_idx
  ON public.build_runtime_sessions(mission_id);

CREATE TRIGGER build_runtime_sessions_touch
  BEFORE UPDATE ON public.build_runtime_sessions
  FOR EACH ROW EXECUTE FUNCTION public.build_touch_updated_at();

-- build_dossiers
CREATE TABLE public.build_dossiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID,
  mission_id UUID REFERENCES public.build_missions(id) ON DELETE SET NULL,
  session_id UUID REFERENCES public.build_runtime_sessions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ready', -- 'draft' | 'ready'
  summary TEXT,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  next_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.build_dossiers TO service_role;
ALTER TABLE public.build_dossiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access to build_dossiers"
  ON public.build_dossiers FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE INDEX build_dossiers_mission_idx ON public.build_dossiers(mission_id);
CREATE INDEX build_dossiers_session_idx ON public.build_dossiers(session_id);

CREATE TRIGGER build_dossiers_touch
  BEFORE UPDATE ON public.build_dossiers
  FOR EACH ROW EXECUTE FUNCTION public.build_touch_updated_at();

-- Runtime rate-limit table
CREATE TABLE public.build_runtime_rate (
  ip_hash TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.build_runtime_rate TO service_role;
ALTER TABLE public.build_runtime_rate ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access to build_runtime_rate"
  ON public.build_runtime_rate FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE INDEX build_runtime_rate_lookup_idx
  ON public.build_runtime_rate(ip_hash, created_at DESC);
