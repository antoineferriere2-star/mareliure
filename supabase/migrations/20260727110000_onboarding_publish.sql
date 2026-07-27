-- LOT 3: links a self-service onboarding record to the Mission it eventually
-- publishes, so the setup wizard can show the public URL/snippet after
-- publish without an indirect join. Nullable — stays null until publishMyDraft
-- runs; existing rows (analyzed/confirmed/draft_ready, not yet published)
-- are unaffected.
ALTER TABLE public.build_workspace_onboarding
  ADD COLUMN mission_id UUID REFERENCES public.build_missions(id) ON DELETE SET NULL;
