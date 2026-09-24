-- FineBindery Europe — spoken_languages and project locale remain independent from country_code.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'marketplace_binders' AND column_name = 'public_languages'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'marketplace_binders' AND column_name = 'spoken_languages'
  ) THEN
    ALTER TABLE public.marketplace_binders RENAME COLUMN public_languages TO spoken_languages;
  END IF;
END $$;

ALTER TABLE public.marketplace_cases
  ADD COLUMN IF NOT EXISTS submission_locale TEXT,
  ADD COLUMN IF NOT EXISTS preferred_language TEXT;

ALTER TABLE public.marketplace_cases
  DROP CONSTRAINT IF EXISTS marketplace_cases_submission_locale_check,
  DROP CONSTRAINT IF EXISTS marketplace_cases_preferred_language_check,
  ADD CONSTRAINT marketplace_cases_submission_locale_check
    CHECK (submission_locale IS NULL OR submission_locale IN ('en', 'fr', 'de', 'it', 'es')),
  ADD CONSTRAINT marketplace_cases_preferred_language_check
    CHECK (preferred_language IS NULL OR preferred_language IN ('en', 'fr', 'de', 'it', 'es'));

CREATE INDEX IF NOT EXISTS marketplace_cases_preferred_language_idx
  ON public.marketplace_cases(preferred_language)
  WHERE preferred_language IS NOT NULL;

COMMENT ON COLUMN public.marketplace_binders.spoken_languages IS
  'Canonical language codes the workshop can use with clients; independent from country_code.';
COMMENT ON COLUMN public.marketplace_cases.submission_locale IS
  'FineBindery presentation locale active when the project was submitted.';
COMMENT ON COLUMN public.marketplace_cases.preferred_language IS
  'Language in which the client prefers workshop communication.';
