ALTER TABLE public.build_workspaces
  ADD COLUMN IF NOT EXISTS notify_on_new_brief TEXT NOT NULL DEFAULT 'all_members';

DO $$
BEGIN
  ALTER TABLE public.build_workspaces
    ADD CONSTRAINT build_workspaces_notify_on_new_brief_check
    CHECK (notify_on_new_brief IN ('all_members', 'owners_only', 'off'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.build_workspaces.notify_on_new_brief IS
  'all_members (default, the behaviour before this column existed) | owners_only | off. Read only through notifyWorkspaceOfNewDossier. Never gates the submission itself: a visitor is never blocked by a notification setting.';