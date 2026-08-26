-- Who gets told when a Project Brief arrives.
--
-- notifyWorkspaceOfNewDossier emails every member of the workspace, with no way
-- to change it. For a product whose value is how fast someone reacts, that is
-- the most expensive missing setting: a business owner who invites two sales
-- reps and a subcontractor cannot stop the subcontractor being emailed every
-- customer's name, address and budget — and cannot stop themselves being
-- emailed either.
--
-- Idempotent and additive. The default reproduces today's behaviour exactly, so
-- nothing changes for an existing workspace until someone chooses otherwise.

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
