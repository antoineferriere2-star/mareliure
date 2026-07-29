-- Visitor Project Summary + secure link (see plan: visitor-facing summary
-- distinct from the internal commercial Project Brief).
--
-- 1. Pin the exact Playbook version that produced a submission's brief, so a
--    later Playbook republish can never retroactively change what an old
--    submission's frozen visitor summary would show. Nullable: existing rows
--    predate this column and have no recoverable version to backfill.
ALTER TABLE public.build_dossiers
  ADD COLUMN IF NOT EXISTS playbook_version_id uuid REFERENCES public.build_playbook_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visitor_summary jsonb,
  ADD COLUMN IF NOT EXISTS visitor_email text,
  ADD COLUMN IF NOT EXISTS visitor_name text;

-- 2. Secure, revisitable access to a visitor's own Project Summary. The raw
--    token is only ever returned once (in the URL / confirmation email);
--    only its SHA-256 hash is stored, mirroring build_runtime_sessions's
--    session_secret_hash pattern. Unlike that pattern, this token is also
--    time-boxed and independently revocable, since it's meant to live in a
--    long-lived email rather than a single browser session.
CREATE TABLE public.build_dossier_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES public.build_dossiers(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX build_dossier_access_tokens_hash_uidx
  ON public.build_dossier_access_tokens (token_hash);

CREATE INDEX build_dossier_access_tokens_dossier_idx
  ON public.build_dossier_access_tokens (dossier_id);

GRANT ALL ON public.build_dossier_access_tokens TO service_role;
ALTER TABLE public.build_dossier_access_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access to build_dossier_access_tokens"
  ON public.build_dossier_access_tokens FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
