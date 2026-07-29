ALTER TABLE public.build_dossiers
  ADD COLUMN IF NOT EXISTS playbook_version_id uuid REFERENCES public.build_playbook_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visitor_summary jsonb,
  ADD COLUMN IF NOT EXISTS visitor_email text,
  ADD COLUMN IF NOT EXISTS visitor_name text,
  ADD COLUMN IF NOT EXISTS visitor_email_sent_at timestamptz;

CREATE TABLE IF NOT EXISTS public.build_dossier_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES public.build_dossiers(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS build_dossier_access_tokens_hash_uidx
  ON public.build_dossier_access_tokens (token_hash);
CREATE INDEX IF NOT EXISTS build_dossier_access_tokens_dossier_idx
  ON public.build_dossier_access_tokens (dossier_id);

GRANT ALL ON public.build_dossier_access_tokens TO service_role;
ALTER TABLE public.build_dossier_access_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to build_dossier_access_tokens" ON public.build_dossier_access_tokens;
CREATE POLICY "No direct access to build_dossier_access_tokens"
  ON public.build_dossier_access_tokens FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);