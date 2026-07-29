-- Tracks whether the visitor confirmation email actually went out, so a
-- resumed/retried view of an already-created dossier reports the true
-- historical outcome instead of always showing "not sent" after the very
-- first request. Never re-attempted on retry — set once, at most, by the
-- single code path that creates the dossier.
ALTER TABLE public.build_dossiers
  ADD COLUMN IF NOT EXISTS visitor_email_sent_at timestamptz;
