-- build_playbooks
CREATE TABLE public.build_playbooks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  project_type text,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  version text NOT NULL DEFAULT 'v1',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT ALL ON public.build_playbooks TO service_role;
ALTER TABLE public.build_playbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access to build_playbooks"
  ON public.build_playbooks
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
CREATE TRIGGER build_playbooks_touch_updated_at
  BEFORE UPDATE ON public.build_playbooks
  FOR EACH ROW EXECUTE FUNCTION public.build_touch_updated_at();

-- build_knowledge_notes
CREATE TABLE public.build_knowledge_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  content text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'proposed',
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT ALL ON public.build_knowledge_notes TO service_role;
ALTER TABLE public.build_knowledge_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access to build_knowledge_notes"
  ON public.build_knowledge_notes
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
CREATE TRIGGER build_knowledge_notes_touch_updated_at
  BEFORE UPDATE ON public.build_knowledge_notes
  FOR EACH ROW EXECUTE FUNCTION public.build_touch_updated_at();

CREATE INDEX build_knowledge_notes_status_idx ON public.build_knowledge_notes (status);
CREATE INDEX build_playbooks_active_idx ON public.build_playbooks (is_active);