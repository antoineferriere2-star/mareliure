-- Playbook versions: immutable published snapshots. A Mission pins to one
-- specific version_id so editing a draft never changes a live Mission's
-- behavior (same reasoning as build_dossiers snapshotting session answers
-- instead of re-reading build_runtime_sessions live).
CREATE TABLE public.build_playbook_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id UUID NOT NULL REFERENCES public.build_playbooks(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  schema JSONB NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (playbook_id, version_number)
);
GRANT ALL ON public.build_playbook_versions TO service_role;
ALTER TABLE public.build_playbook_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access to build_playbook_versions"
  ON public.build_playbook_versions FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
CREATE INDEX build_playbook_versions_playbook_idx ON public.build_playbook_versions(playbook_id);

-- build_playbooks becomes the mutable working copy (draft_schema) + a pointer
-- to whichever version is currently published. The old thin {id,title,why}
-- steps/version columns are dropped outright — no production data depends on
-- them, and this app is pre-production.
ALTER TABLE public.build_playbooks
  ADD COLUMN draft_schema JSONB NOT NULL DEFAULT '{"schemaVersion":1,"sections":[],"validationRules":[]}'::jsonb,
  ADD COLUMN published_version_id UUID REFERENCES public.build_playbook_versions(id) ON DELETE SET NULL,
  DROP COLUMN steps,
  DROP COLUMN version;

-- A Mission pins to one immutable published Playbook version. RESTRICT
-- (rather than the versions table's own CASCADE-from-playbook) so a version
-- actively used by a Mission can't be silently deleted out from under it.
ALTER TABLE public.build_missions
  ADD COLUMN playbook_version_id UUID REFERENCES public.build_playbook_versions(id) ON DELETE RESTRICT;
